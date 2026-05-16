const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const { getDatabase } = require('../database/init');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/os - Listar todas as ordens de serviço
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        const osList = db.prepare(`
            SELECT so.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email,
            (SELECT COUNT(*) FROM os_items oi 
             JOIN products p ON oi.product_id = p.id 
             WHERE oi.os_id = so.id AND oi.item_type = 'product' AND p.current_stock < oi.quantity AND p.is_service = 0) as missing_parts_count
            FROM service_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            ORDER BY so.created_at DESC
        `).all();
        res.json({ success: true, data: osList });
    } catch (error) {
        console.error('Erro ao listar O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar ordens de serviço.' });
    }
});

// GET /api/os/:id - Obter detalhes de uma O.S. com itens
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const os = db.prepare(`
            SELECT so.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
            FROM service_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            WHERE so.id = ?
        `).get(req.params.id);

        if (!os) return res.status(404).json({ success: false, message: 'O.S. não encontrada.' });

        const items = db.prepare(`
            SELECT oi.*, p.name as product_name
            FROM os_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.os_id = ?
        `).all(os.id);

        const history = db.prepare(`
            SELECT description, created_at
            FROM activity_log
            WHERE entity = 'os' AND entity_id = ?
            ORDER BY created_at ASC
        `).all(os.id);

        os.items = items;
        os.history = history;
        res.json({ success: true, data: os });
    } catch (error) {
        console.error('Erro ao buscar O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar ordem de serviço.' });
    }
});

// POST /api/os - Criar uma nova O.S.
router.post('/', (req, res) => {
    try {
        const db = getDatabase();
        const { customer_id, device_model, device_serial, device_password, reported_defect, technical_report } = req.body;

        if (!device_model || !reported_defect) {
            return res.status(400).json({ success: false, message: 'Modelo do aparelho e defeito relatado são obrigatórios.' });
        }

        const info = db.prepare(`
            INSERT INTO service_orders (customer_id, device_model, device_serial, device_password, reported_defect, technical_report, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(customer_id || null, device_model, device_serial || null, device_password || null, reported_defect, technical_report || null, req.session.userId);

        db.prepare(`INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'create', 'os', ?, ?)`)
            .run(req.session.userId, info.lastInsertRowid, `Ordem de Serviço #${info.lastInsertRowid} criada`);

        res.json({ success: true, data: { id: info.lastInsertRowid }, message: 'O.S. criada com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar ordem de serviço.' });
    }
});

// PUT /api/os/:id - Atualizar dados da O.S.
router.put('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const { customer_id, device_model, device_serial, device_password, reported_defect, technical_report } = req.body;

        db.prepare(`
            UPDATE service_orders SET
                customer_id = COALESCE(?, customer_id),
                device_model = COALESCE(?, device_model),
                device_serial = COALESCE(?, device_serial),
                device_password = COALESCE(?, device_password),
                reported_defect = COALESCE(?, reported_defect),
                technical_report = COALESCE(?, technical_report),
                updated_at = datetime('now','localtime')
            WHERE id = ?
        `).run(customer_id, device_model, device_serial, device_password, reported_defect, technical_report, req.params.id);

        res.json({ success: true, message: 'O.S. atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar ordem de serviço.' });
    }
});

// PUT /api/os/:id/status - Atualizar status da O.S. (Drag in Kanban)
router.put('/:id/status', (req, res) => {
    try {
        const db = getDatabase();
        const { status, serials } = req.body;
        const osId = req.params.id;
        const validStatuses = ['budgeting','waiting_parts','approved','in_repair','ready','delivered','cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Status inválido.' });
        }

        const os = db.prepare('SELECT status FROM service_orders WHERE id = ?').get(osId);
        if (!os) return res.status(404).json({ success: false, message: 'O.S. não encontrada.' });
        
        const oldStatus = os.status;

        // Se moveu para 'approved' vindo de 'budgeting' ou 'waiting_parts'
        if (status === 'approved' && ['budgeting', 'waiting_parts'].includes(oldStatus)) {
            const items = db.prepare(`
                SELECT oi.*, p.track_serial, p.current_stock, p.name 
                FROM os_items oi 
                JOIN products p ON oi.product_id = p.id 
                WHERE oi.os_id = ? AND oi.item_type = 'product'
            `).all(osId);

            db.transaction(() => {
                for (let item of items) {
                    if (item.current_stock < item.quantity) {
                        throw new Error(`Estoque insuficiente para a peça: ${item.name}`);
                    }
                    if (item.track_serial) {
                        const providedSerials = (serials && serials[item.id]) || [];
                        if (providedSerials.length !== item.quantity) {
                            throw new Error(`A peça "${item.name}" exige ${item.quantity} números de série válidos.`);
                        }
                        
                        for (let s of providedSerials) {
                            const dbSerial = db.prepare('SELECT status FROM product_serials WHERE product_id = ? AND serial_number = ?').get(item.product_id, s);
                            if (!dbSerial || dbSerial.status !== 'available') {
                                throw new Error(`O serial ${s} para "${item.name}" não está disponível.`);
                            }
                            db.prepare("UPDATE product_serials SET status = 'sold' WHERE product_id = ? AND serial_number = ?").run(item.product_id, s);
                        }
                        db.prepare('UPDATE os_items SET serial_number = ? WHERE id = ?').run(providedSerials.join(','), item.id);
                    }
                    
                    db.prepare('UPDATE products SET current_stock = current_stock - ? WHERE id = ?').run(item.quantity, item.product_id);
                    const afterBal = item.current_stock - item.quantity;
                    db.prepare(`
                        INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason, reference_id)
                        VALUES (?, ?, 'exit', ?, ?, ?, ?)
                    `).run(item.product_id, req.session.userId, item.quantity, afterBal, `Uso em O.S. #${osId}`, osId);
                }
                db.prepare(`UPDATE service_orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(status, osId);
            })();
        } 
        // Se cancelou uma OS já aprovada, estorna o estoque
        else if (status === 'cancelled' && ['approved', 'in_repair', 'ready', 'delivered'].includes(oldStatus)) {
            const items = db.prepare(`
                SELECT oi.*, p.track_serial, p.current_stock 
                FROM os_items oi 
                JOIN products p ON oi.product_id = p.id 
                WHERE oi.os_id = ? AND oi.item_type = 'product'
            `).all(osId);

            db.transaction(() => {
                for (let item of items) {
                    if (item.track_serial && item.serial_number) {
                        const usedSerials = item.serial_number.split(',');
                        for (let s of usedSerials) {
                            db.prepare("UPDATE product_serials SET status = 'available' WHERE product_id = ? AND serial_number = ?").run(item.product_id, s);
                        }
                        db.prepare('UPDATE os_items SET serial_number = NULL WHERE id = ?').run(item.id);
                    }
                    db.prepare('UPDATE products SET current_stock = current_stock + ? WHERE id = ?').run(item.quantity, item.product_id);
                    const currentProd = db.prepare('SELECT current_stock FROM products WHERE id = ?').get(item.product_id);
                    db.prepare(`
                        INSERT INTO stock_movements (product_id, user_id, type, quantity, balance_after, reason, reference_id)
                        VALUES (?, ?, 'entry', ?, ?, ?, ?)
                    `).run(item.product_id, req.session.userId, item.quantity, currentProd.current_stock, `Estorno OS #${osId} Cancelada`, osId);
                }
                db.prepare(`UPDATE service_orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(status, osId);
            })();
        } else {
            // Transição normal sem impacto em estoque
            db.prepare(`UPDATE service_orders SET status = ?, updated_at = datetime('now','localtime') WHERE id = ?`).run(status, osId);
        }

        db.prepare(`INSERT INTO activity_log (user_id, action, entity, entity_id, description) VALUES (?, 'update', 'os', ?, ?)`)
            .run(req.session.userId, req.params.id, `Status da O.S. #${req.params.id} alterado para ${status}`);

        res.json({ success: true, message: 'Status atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar status da O.S.:', error);
        res.status(400).json({ success: false, message: error.message || 'Erro ao atualizar status da ordem de serviço.' });
    }
});

// POST /api/os/:id/items - Adicionar item ao orçamento da O.S.
router.post('/:id/items', (req, res) => {
    try {
        const db = getDatabase();
        const { item_type, product_id, description, quantity, unit_price } = req.body;
        
        if (!item_type || !description || quantity < 1 || unit_price < 0) {
            return res.status(400).json({ success: false, message: 'Dados do item inválidos.' });
        }

        const total_price = quantity * unit_price;

        // Transaction to add item and update O.S. totals
        db.transaction(() => {
            db.prepare(`
                INSERT INTO os_items (os_id, item_type, product_id, description, quantity, unit_price, total_price)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `).run(req.params.id, item_type, product_id || null, description, quantity, unit_price, total_price);

            // Recalculate totals
            const totals = db.prepare(`
                SELECT 
                    SUM(CASE WHEN item_type = 'product' THEN total_price ELSE 0 END) as parts,
                    SUM(CASE WHEN item_type = 'service' THEN total_price ELSE 0 END) as labor
                FROM os_items WHERE os_id = ?
            `).get(req.params.id);

            const total = (totals.parts || 0) + (totals.labor || 0);

            db.prepare(`
                UPDATE service_orders 
                SET total_parts = ?, total_labor = ?, total_amount = ?, updated_at = datetime('now','localtime')
                WHERE id = ?
            `).run(totals.parts || 0, totals.labor || 0, total, req.params.id);
        })();

        res.json({ success: true, message: 'Item adicionado ao orçamento.' });
    } catch (error) {
        console.error('Erro ao adicionar item na O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao adicionar item.' });
    }
});

// DELETE /api/os/items/:itemId - Remover item do orçamento
router.delete('/items/:itemId', (req, res) => {
    try {
        const db = getDatabase();
        const item = db.prepare('SELECT os_id FROM os_items WHERE id = ?').get(req.params.itemId);
        
        if (!item) return res.status(404).json({ success: false, message: 'Item não encontrado.' });

        db.transaction(() => {
            db.prepare('DELETE FROM os_items WHERE id = ?').run(req.params.itemId);

            // Recalculate totals
            const totals = db.prepare(`
                SELECT 
                    SUM(CASE WHEN item_type = 'product' THEN total_price ELSE 0 END) as parts,
                    SUM(CASE WHEN item_type = 'service' THEN total_price ELSE 0 END) as labor
                FROM os_items WHERE os_id = ?
            `).get(item.os_id);

            const total = (totals.parts || 0) + (totals.labor || 0);

            db.prepare(`
                UPDATE service_orders 
                SET total_parts = ?, total_labor = ?, total_amount = ?, updated_at = datetime('now','localtime')
                WHERE id = ?
            `).run(totals.parts || 0, totals.labor || 0, total, item.os_id);
        })();

        res.json({ success: true, message: 'Item removido do orçamento.' });
    } catch (error) {
        console.error('Erro ao remover item:', error);
        res.status(500).json({ success: false, message: 'Erro ao remover item da O.S.' });
    }
});

// POST /api/os/:id/email - Enviar relatório da O.S. por E-mail
router.post('/:id/email', async (req, res) => {
    try {
        const { target_email } = req.body;
        if (!target_email) return res.status(400).json({ success: false, message: 'E-mail de destino não informado.' });

        const db = getDatabase();
        const id = req.params.id;

        // Fetch OS details
        const os = db.prepare(`
            SELECT so.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email
            FROM service_orders so
            LEFT JOIN customers c ON so.customer_id = c.id
            WHERE so.id = ?
        `).get(id);

        if (!os) return res.status(404).json({ success: false, message: 'O.S. não encontrada.' });

        const items = db.prepare(`
            SELECT oi.*, p.name as product_name
            FROM os_items oi
            LEFT JOIN products p ON oi.product_id = p.id
            WHERE oi.os_id = ?
        `).all(id);

        // Fetch SMTP and Store Settings
        const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'store_name', 'store_logo'];
        const settings = {};
        keys.forEach(k => {
            const r = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(k);
            settings[k] = r ? r.value : '';
        });

        if (!settings.smtp_host || !settings.smtp_user || !settings.smtp_pass) {
            return res.status(400).json({ success: false, message: 'Configurações SMTP incompletas. Acesse as Configurações da Loja.' });
        }

        // Setup Nodemailer Transport
        const transporter = nodemailer.createTransport({
            host: settings.smtp_host,
            port: parseInt(settings.smtp_port) || 465,
            secure: (parseInt(settings.smtp_port) === 465), // true for 465, false for other ports
            auth: {
                user: settings.smtp_user,
                pass: settings.smtp_pass
            }
        });

        const statusMap = {
            'budgeting': 'Orçamentando',
            'waiting_parts': 'Aguardando Peça',
            'approved': 'Aprovado',
            'in_repair': 'Em Reparo',
            'ready': 'Pronto',
            'delivered': 'Entregue',
            'cancelled': 'Cancelado'
        };

        const totalPecas = items.filter(i => i.item_type === 'product').reduce((sum, i) => sum + i.total_price, 0);
        const totalServicos = items.filter(i => i.item_type === 'service').reduce((sum, i) => sum + i.total_price, 0);

        let itemsHtml = '';
        if (items && items.length > 0) {
            itemsHtml = `
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                        <tr style="background-color: #f3f4f6;">
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 14px;">TIPO</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: left; font-size: 14px;">DESCRIÇÃO</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">QTD</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px;">V. UNIT</th>
                            <th style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px;">TOTAL</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>
                                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${item.item_type === 'product' ? 'Peça' : 'Serviço'}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-size: 14px;">${item.product_name || item.description}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px;">${item.quantity}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px;">R$ ${item.unit_price.toFixed(2)}</td>
                                <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px;"><strong>R$ ${item.total_price.toFixed(2)}</strong></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        } else {
            itemsHtml = '<p style="text-align:center; color:#666; padding: 20px;">Nenhum item adicionado ao orçamento ainda.</p>';
        }

        const storeNameEscaped = (settings.store_name || 'STOCKCELL').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        const logoHtml = settings.store_logo ? `<img src="${settings.store_logo}" style="max-height: 60px; object-fit: contain; border-radius: 8px; margin-right: 15px; vertical-align: middle;">` : '';
        
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; color: #1f2937;">
                <div style="border-bottom: 2px solid #4f46e5; padding-bottom: 15px; margin-bottom: 20px; display: flex; align-items: center;">
                    ${logoHtml}
                    <div>
                        <h2 style="color: #4f46e5; margin: 0;">${storeNameEscaped}</h2>
                        <span style="color: #6b7280; font-size: 14px;">Ordem de Serviço #${String(os.id).padStart(4,'0')}</span>
                    </div>
                </div>
                
                <p>Olá <strong>${os.customer_name || 'Cliente'}</strong>,</p>
                <p>Aqui está o resumo do orçamento da sua Ordem de Serviço.</p>
                
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0 0 5px 0;"><strong>Aparelho:</strong> ${os.device_model}</p>
                    <p style="margin: 0 0 5px 0;"><strong>Defeito Relatado:</strong> ${os.reported_defect}</p>
                    <p style="margin: 0 0 5px 0;"><strong>Status Atual:</strong> <span style="background:#eef2ff; color:#4f46e5; padding:2px 8px; border-radius:4px; font-size:14px;">${statusMap[os.status] || os.status}</span></p>
                </div>
                
                <h3 style="font-size: 16px;">Detalhes do Orçamento</h3>
                ${itemsHtml}
                
                <div style="text-align: right; margin-top: 20px; font-size: 14px;">
                    <p style="margin: 5px 0;">Total de Peças: R$ ${totalPecas.toFixed(2)}</p>
                    <p style="margin: 5px 0;">Mão de Obra: R$ ${totalServicos.toFixed(2)}</p>
                    <p style="margin: 10px 0; font-size: 18px; font-weight: bold; color: #4f46e5;">TOTAL GERAL: R$ ${(totalPecas + totalServicos).toFixed(2)}</p>
                </div>
                
                <p style="margin-top: 30px; font-size: 14px; color: #6b7280; text-align: center;">
                    Atenciosamente,<br>
                    <strong>Equipe ${storeNameEscaped}</strong>
                </p>
            </div>
        `;

        // Send Email
        const info = await transporter.sendMail({
            from: `"${settings.store_name || 'StockCell Assistência'}" <${settings.smtp_user}>`,
            to: target_email,
            subject: `Orçamento da Ordem de Serviço #${String(os.id).padStart(4,'0')} - ${statusMap[os.status] || os.status}`,
            html: emailHtml
        });

        res.json({ success: true, message: 'E-mail enviado com sucesso!', messageId: info.messageId });
    } catch (error) {
        console.error('Erro ao enviar e-mail:', error);
        res.status(500).json({ success: false, message: 'Erro ao enviar e-mail. Verifique as configurações SMTP.' });
    }
});

module.exports = router;
