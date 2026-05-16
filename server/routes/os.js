const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');

router.use(requireAuth);

// GET /api/os - Listar todas as ordens de serviço
router.get('/', async (req, res) => {
    try {
        const { data: osListRaw, error } = await supabase.from('service_orders').select('*, customers(name, phone, email)').order('created_at', { ascending: false });
        if (error) throw error;
        
        const osIds = (osListRaw || []).map(os => os.id);
        let itemsMap = {};
        if (osIds.length > 0) {
            const { data: osItemsRaw } = await supabase.from('os_items').select('*, products(current_stock, is_service)').in('os_id', osIds).eq('item_type', 'product');
            if (osItemsRaw) {
                osItemsRaw.forEach(item => {
                    if (item.products && item.products.is_service === false && item.products.current_stock < item.quantity) {
                        itemsMap[item.os_id] = (itemsMap[item.os_id] || 0) + 1;
                    }
                });
            }
        }
        
        const osList = (osListRaw || []).map(os => {
            // Extrair serial number caso exista " (SN: ...)"
            let device_model = os.device_info || '';
            let device_serial = '';
            const match = device_model.match(/(.*)\s+\(SN:\s+(.*)\)$/);
            if (match) {
                device_model = match[1];
                device_serial = match[2];
            }

            return {
                ...os,
                device_model,
                device_serial,
                reported_defect: os.defect_reported,
                customer_name: os.customers?.name,
                customer_phone: os.customers?.phone,
                customer_email: os.customers?.email,
                missing_parts_count: itemsMap[os.id] || 0
            };
        });

        res.json({ success: true, data: osList });
    } catch (error) {
        console.error('Erro ao listar O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar ordens de serviço.' });
    }
});

// GET /api/os/:id - Obter detalhes de uma O.S. com itens
router.get('/:id', async (req, res) => {
    try {
        const { data: os } = await supabase.from('service_orders').select('*, customers(name, phone, email)').eq('id', req.params.id).maybeSingle();
        if (!os) return res.status(404).json({ success: false, message: 'O.S. não encontrada.' });

        // Mapeamento de campos DB -> Frontend
        let device_model = os.device_info || '';
        let device_serial = '';
        const match = device_model.match(/(.*)\s+\(SN:\s+(.*)\)$/);
        if (match) {
            device_model = match[1];
            device_serial = match[2];
        }
        os.device_model = device_model;
        os.device_serial = device_serial;
        os.reported_defect = os.defect_reported;

        os.customer_name = os.customers?.name;
        os.customer_phone = os.customers?.phone;
        os.customer_email = os.customers?.email;

        const { data: itemsRaw } = await supabase.from('os_items').select('*, products(name)').eq('os_id', os.id);
        const items = (itemsRaw || []).map(i => ({ ...i, product_name: i.products?.name }));

        const { data: history } = await supabase.from('activity_log').select('description, created_at').eq('entity', 'os').eq('entity_id', os.id).order('created_at', { ascending: true });

        os.items = items;
        os.history = history || [];
        res.json({ success: true, data: os });
    } catch (error) {
        console.error('Erro ao buscar O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar ordem de serviço.' });
    }
});

// POST /api/os - Criar uma nova O.S.
router.post('/', async (req, res) => {
    try {
        const { customer_id, device_model, device_serial, device_password, reported_defect, technical_report } = req.body;

        if (!device_model || !reported_defect) {
            return res.status(400).json({ success: false, message: 'Modelo do aparelho e defeito relatado são obrigatórios.' });
        }

        const device_info = device_serial ? `${device_model} (SN: ${device_serial})` : device_model;

        const { data: info, error } = await supabase.from('service_orders').insert({
            customer_id: customer_id || null, 
            device_info, 
            device_password: device_password || null, 
            defect_reported: reported_defect, 
            technical_report: technical_report || null
        }).select('id').single();
        if (error) throw error;

        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'create', entity: 'os', entity_id: info.id, description: `Ordem de Serviço #${info.id} criada`
        });

        res.json({ success: true, data: { id: info.id }, message: 'O.S. criada com sucesso!' });
    } catch (error) {
        console.error('Erro ao criar O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar ordem de serviço.' });
    }
});

// PUT /api/os/:id - Atualizar dados da O.S.
router.put('/:id', async (req, res) => {
    try {
        const { customer_id, device_model, device_serial, device_password, reported_defect, technical_report } = req.body;
        
        const { data: existingOs } = await supabase.from('service_orders').select('*').eq('id', req.params.id).maybeSingle();
        if (!existingOs) return res.status(404).json({ success: false, message: 'O.S. não encontrada.' });

        // Recuperar device_model e device_serial originais para update parcial
        let orig_model = existingOs.device_info || '';
        let orig_serial = '';
        const match = orig_model.match(/(.*)\s+\(SN:\s+(.*)\)$/);
        if (match) { orig_model = match[1]; orig_serial = match[2]; }

        const final_model = device_model !== undefined ? device_model : orig_model;
        const final_serial = device_serial !== undefined ? device_serial : orig_serial;
        const device_info = final_serial ? `${final_model} (SN: ${final_serial})` : final_model;

        const { error } = await supabase.from('service_orders').update({
            customer_id: customer_id || existingOs.customer_id,
            device_info,
            device_password: device_password !== undefined ? device_password : existingOs.device_password,
            defect_reported: reported_defect !== undefined ? reported_defect : existingOs.defect_reported,
            technical_report: technical_report !== undefined ? technical_report : existingOs.technical_report,
            updated_at: new Date().toISOString()
        }).eq('id', req.params.id);
        if (error) throw error;

        res.json({ success: true, message: 'O.S. atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar ordem de serviço.' });
    }
});

// PUT /api/os/:id/status - Atualizar status da O.S. (Drag in Kanban)
router.put('/:id/status', async (req, res) => {
    try {
        const { status, serials } = req.body;
        const osId = req.params.id;
        const validStatuses = ['budgeting','waiting_parts','approved','in_repair','ready','delivered','cancelled'];
        
        if (!validStatuses.includes(status)) return res.status(400).json({ success: false, message: 'Status inválido.' });

        const { data: os } = await supabase.from('service_orders').select('status').eq('id', osId).maybeSingle();
        if (!os) return res.status(404).json({ success: false, message: 'O.S. não encontrada.' });
        
        const oldStatus = os.status;

        if (status === 'approved' && ['budgeting', 'waiting_parts'].includes(oldStatus)) {
            const { data: itemsRaw } = await supabase.from('os_items').select('*, products(track_serial, current_stock, name)').eq('os_id', osId).eq('item_type', 'product');
            const items = (itemsRaw || []).map(i => ({ ...i, track_serial: i.products?.track_serial, current_stock: i.products?.current_stock, name: i.products?.name }));

            for (let item of items) {
                if (item.current_stock < item.quantity) throw new Error(`Estoque insuficiente para a peça: ${item.name}`);
                
                if (item.track_serial) {
                    const providedSerials = (serials && serials[item.id]) || [];
                    if (providedSerials.length !== item.quantity) throw new Error(`A peça "${item.name}" exige ${item.quantity} números de série válidos.`);
                    
                    for (let s of providedSerials) {
                        const { data: dbSerial } = await supabase.from('product_serials').select('status').eq('product_id', item.product_id).eq('serial_number', s).maybeSingle();
                        if (!dbSerial || dbSerial.status !== 'available') throw new Error(`O serial ${s} para "${item.name}" não está disponível.`);
                        
                        await supabase.from('product_serials').update({ status: 'sold' }).eq('product_id', item.product_id).eq('serial_number', s);
                    }
                    await supabase.from('os_items').update({ serial_number: providedSerials.join(',') }).eq('id', item.id);
                }
                
                const afterBal = item.current_stock - item.quantity;
                await supabase.from('products').update({ current_stock: afterBal }).eq('id', item.product_id);
                
                await supabase.from('stock_movements').insert({
                    product_id: item.product_id, user_id: req.session.userId, type: 'exit', quantity: item.quantity, balance_after: afterBal, reason: `Uso em O.S. #${osId}`, reference_id: osId
                });
            }
            await supabase.from('service_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', osId);

        } else if (status === 'cancelled' && ['approved', 'in_repair', 'ready', 'delivered'].includes(oldStatus)) {
            const { data: itemsRaw } = await supabase.from('os_items').select('*, products(track_serial, current_stock)').eq('os_id', osId).eq('item_type', 'product');
            const items = (itemsRaw || []).map(i => ({ ...i, track_serial: i.products?.track_serial, current_stock: i.products?.current_stock }));

            for (let item of items) {
                if (item.track_serial && item.serial_number) {
                    const usedSerials = item.serial_number.split(',');
                    for (let s of usedSerials) {
                        await supabase.from('product_serials').update({ status: 'available' }).eq('product_id', item.product_id).eq('serial_number', s);
                    }
                    await supabase.from('os_items').update({ serial_number: null }).eq('id', item.id);
                }
                
                const newStock = item.current_stock + item.quantity;
                await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
                
                await supabase.from('stock_movements').insert({
                    product_id: item.product_id, user_id: req.session.userId, type: 'entry', quantity: item.quantity, balance_after: newStock, reason: `Estorno OS #${osId} Cancelada`, reference_id: osId
                });
            }
            await supabase.from('service_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', osId);
        } else {
            await supabase.from('service_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', osId);
        }

        await supabase.from('activity_log').insert({
            user_id: req.session.userId, action: 'update', entity: 'os', entity_id: osId, description: `Status da O.S. #${osId} alterado para ${status}`
        });

        res.json({ success: true, message: 'Status atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao atualizar status da O.S.:', error);
        res.status(400).json({ success: false, message: error.message || 'Erro ao atualizar status da ordem de serviço.' });
    }
});

// POST /api/os/:id/items - Adicionar item ao orçamento da O.S.
router.post('/:id/items', async (req, res) => {
    try {
        const { item_type, product_id, description, quantity, unit_price } = req.body;
        if (!item_type || !description || quantity < 1 || unit_price < 0) return res.status(400).json({ success: false, message: 'Dados do item inválidos.' });

        const total_price = quantity * unit_price;

        await supabase.from('os_items').insert({
            os_id: req.params.id, item_type, product_id: product_id || null, description, quantity, unit_price, total_price
        });

        const { data: itemsRaw } = await supabase.from('os_items').select('item_type, total_price').eq('os_id', req.params.id);
        const parts = (itemsRaw || []).filter(i => i.item_type === 'product').reduce((s, i) => s + i.total_price, 0);
        const labor = (itemsRaw || []).filter(i => i.item_type === 'service').reduce((s, i) => s + i.total_price, 0);
        const total = parts + labor;

        await supabase.from('service_orders').update({
            total_parts: parts, total_labor: labor, total_amount: total, updated_at: new Date().toISOString()
        }).eq('id', req.params.id);

        res.json({ success: true, message: 'Item adicionado ao orçamento.' });
    } catch (error) {
        console.error('Erro ao adicionar item na O.S.:', error);
        res.status(500).json({ success: false, message: 'Erro ao adicionar item.' });
    }
});

// DELETE /api/os/items/:itemId - Remover item do orçamento
router.delete('/items/:itemId', async (req, res) => {
    try {
        const { data: item } = await supabase.from('os_items').select('os_id').eq('id', req.params.itemId).maybeSingle();
        if (!item) return res.status(404).json({ success: false, message: 'Item não encontrado.' });

        await supabase.from('os_items').delete().eq('id', req.params.itemId);

        const { data: itemsRaw } = await supabase.from('os_items').select('item_type, total_price').eq('os_id', item.os_id);
        const parts = (itemsRaw || []).filter(i => i.item_type === 'product').reduce((s, i) => s + i.total_price, 0);
        const labor = (itemsRaw || []).filter(i => i.item_type === 'service').reduce((s, i) => s + i.total_price, 0);
        const total = parts + labor;

        await supabase.from('service_orders').update({
            total_parts: parts, total_labor: labor, total_amount: total, updated_at: new Date().toISOString()
        }).eq('id', item.os_id);

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

        const { data: os } = await supabase.from('service_orders').select('*, customers(name, phone, email)').eq('id', id).maybeSingle();
        if (!os) return res.status(404).json({ success: false, message: 'O.S. não encontrada.' });
        os.customer_name = os.customers?.name;

        const { data: itemsRaw } = await supabase.from('os_items').select('*, products(name)').eq('os_id', id);
        const items = (itemsRaw || []).map(i => ({ ...i, product_name: i.products?.name }));

        const keys = ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'store_name', 'store_logo'];
        const { data: appSettingsRaw } = await supabase.from('app_settings').select('key, value').in('key', keys);
        const settings = {};
        (appSettingsRaw || []).forEach(r => settings[r.key] = r.value);

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
