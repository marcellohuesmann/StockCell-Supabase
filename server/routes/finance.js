const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const supabase = require('../database/supabase');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

router.use(requireAuth);

// Check permission middleware specifically for finance
const requireFinance = async (req, res, next) => {
    try {
        const role = req.session.role;
        if (role === 'admin') return next();
        
        const { data: row } = await supabase.from('app_settings').select('value').eq('key', 'permissions').maybeSingle();
        if (row) {
            const permissions = JSON.parse(row.value);
            if (permissions.finance_manage && permissions.finance_manage.operator) {
                return next();
            }
        }
        res.status(403).json({ success: false, message: 'Acesso negado ao m\u00f3dulo financeiro.' });
    } catch (e) {
        res.status(403).json({ success: false, message: 'Acesso negado.' });
    }
};

router.use(requireFinance);

/**
 * GET /api/finance/categories
 * List financial categories
 */
router.get('/categories', async (req, res) => {
    try {
        const { data: categories, error } = await supabase.from('transaction_categories').select('*').order('type').order('name');
        if (error) throw error;
        res.json({ success: true, data: categories });
    } catch (error) {
        console.error('Erro ao listar categorias:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar categorias.' });
    }
});

/**
 * POST /api/finance/categories
 * Create new category
 */
router.post('/categories', async (req, res) => {
    try {
        const { name, type, color } = req.body;
        if (!name || !type) return res.status(400).json({ success: false, message: 'Nome e tipo são obrigatórios.' });

        const { data: info, error } = await supabase.from('transaction_categories').insert({ name, type, color: color || '#808080' }).select('id').single();
        if (error) throw error;

        res.status(201).json({ success: true, message: 'Categoria criada.', data: { id: info.id } });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao criar categoria.' });
    }
});

/**
 * PUT /api/finance/categories/:id
 */
router.put('/categories/:id', async (req, res) => {
    try {
        const { name, type, color } = req.body;
        const { error } = await supabase.from('transaction_categories').update({ name, type, color }).eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true, message: 'Categoria atualizada.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao atualizar categoria.' });
    }
});

/**
 * DELETE /api/finance/categories/:id
 */
router.delete('/categories/:id', async (req, res) => {
    try {
        const { data: inUse } = await supabase.from('transactions').select('id').eq('category_id', req.params.id).limit(1).maybeSingle();
        if (inUse) return res.status(400).json({ success: false, message: 'Esta categoria está em uso e não pode ser excluída.' });
        
        await supabase.from('transaction_categories').delete().eq('id', req.params.id);
        res.json({ success: true, message: 'Categoria excluída.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Erro ao excluir categoria.' });
    }
});

/**
 * GET /api/finance/transactions
 * List transactions with filters (month, status, type)
 */
router.get('/transactions', async (req, res) => {
    try {
        let query = supabase.from('transactions').select('*, transaction_categories(name, color)');

        if (req.query.type) query = query.eq('type', req.query.type);
        if (req.query.status) query = query.eq('status', req.query.status);
        if (req.query.month) {
            const startMonth = `${req.query.month}-01`;
            const d = new Date(`${req.query.month}-01`);
            d.setMonth(d.getMonth() + 1);
            const endMonth = d.toISOString().split('T')[0];
            query = query.gte('due_date', startMonth).lt('due_date', endMonth);
        }

        query = query.order('due_date', { ascending: false }).order('created_at', { ascending: false });
        
        const { data: rawTransactions, error } = await query;
        if (error) throw error;
        
        let transactions = (rawTransactions || []).map(t => ({
            ...t,
            category_name: t.transaction_categories?.name,
            category_color: t.transaction_categories?.color
        }));

        if (transactions.length > 0) {
            const txIds = transactions.map(t => t.id);
            const { data: payments } = await supabase.from('transaction_payments').select('*').in('transaction_id', txIds).order('payment_date', { ascending: true });
            
            transactions.forEach(t => {
                t.payments = (payments || []).filter(p => p.transaction_id === t.id);
            });
        }

        res.json({ success: true, data: transactions });
    } catch (error) {
        console.error('Erro ao listar transacoes:', error);
        res.status(500).json({ success: false, message: 'Erro ao buscar transações.' });
    }
});

/**
 * GET /api/finance/summary
 * Get financial summary for a month
 */
router.get('/summary', async (req, res) => {
    try {
        const d = new Date();
        const localMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const month = req.query.month || localMonth;
        
        const startMonth = `${month}-01`;
        const dateObj = new Date(`${month}-01`);
        dateObj.setMonth(dateObj.getMonth() + 1);
        const endMonth = dateObj.toISOString().split('T')[0];
        
        const { data: txs, error } = await supabase.from('transactions')
            .select('type, status, amount, paid_amount')
            .gte('due_date', startMonth)
            .lt('due_date', endMonth);
            
        if (error) throw error;
        
        let total_received = 0;
        let total_to_receive = 0;
        let total_paid = 0;
        let total_to_pay = 0;
        
        (txs || []).forEach(tx => {
            if (tx.type === 'income') {
                total_received += tx.paid_amount || 0;
                if (tx.status !== 'completed') {
                    total_to_receive += (tx.amount - (tx.paid_amount || 0));
                }
            } else if (tx.type === 'expense') {
                total_paid += tx.paid_amount || 0;
                if (tx.status !== 'completed') {
                    total_to_pay += (tx.amount - (tx.paid_amount || 0));
                }
            }
        });

        const summary = { total_received, total_to_receive, total_paid, total_to_pay };

        res.json({ success: true, data: summary });
    } catch (error) {
        console.error('Erro no resumo financeiro:', error);
        res.status(500).json({ success: false, message: 'Erro ao gerar resumo.' });
    }
});

// POST /api/finance/transactions
router.post('/transactions', async (req, res) => {
    try {
        const { type, description, amount, status, due_date, notes, category_id, account_id, barcode } = req.body;
        const parsedAmount = parseFloat(amount);
        if (!type || !description || isNaN(parsedAmount) || parsedAmount <= 0 || !due_date) {
            return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatórios corretamente (Valor deve ser maior que 0).' });
        }

        const initialStatus = status || 'pending';
        const paidAmount = initialStatus === 'completed' ? parsedAmount : 0;

        const { data: info, error } = await supabase.from('transactions').insert({
            type, category_id: category_id || null, description, amount: parsedAmount, paid_amount: paidAmount, status: initialStatus, due_date, notes: notes || '', barcode: barcode || null
        }).select('id').single();
        if (error) throw error;
        
        const txId = info.id;

        if (initialStatus === 'completed' && account_id) {
            const payDate = new Date().toISOString().substring(0, 10);
            await supabase.from('transaction_payments').insert({
                transaction_id: txId, account_id, amount: parsedAmount, payment_method: 'cash', payment_date: payDate
            });

            const { data: acc } = await supabase.from('bank_accounts').select('current_balance').eq('id', account_id).single();
            if (acc) {
                const newBal = type === 'income' ? acc.current_balance + parsedAmount : acc.current_balance - parsedAmount;
                await supabase.from('bank_accounts').update({ current_balance: newBal }).eq('id', account_id);
            }
        }

        res.status(201).json({ success: true, message: 'Transação registrada.', data: { id: txId } });
    } catch (error) {
        console.error('Erro ao criar transacao:', error);
        res.status(500).json({ success: false, message: 'Erro ao registrar transação.' });
    }
});

/**
 * PUT /api/finance/transactions/:id/pay
 * Mark transaction as completed (paid/received) or partially paid
 */
router.put('/transactions/:id/pay', async (req, res) => {
    try {
        const { payment_method, payment_date, amount, account_id } = req.body;
        const { data: tx } = await supabase.from('transactions').select('*').eq('id', req.params.id).maybeSingle();
        
        if (!tx) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
        
        const dLoc = new Date();
        const localDate = `${dLoc.getFullYear()}-${String(dLoc.getMonth()+1).padStart(2,'0')}-${String(dLoc.getDate()).padStart(2,'0')}`;
        const payDate = payment_date || localDate;
        
        const remaining = tx.amount - tx.paid_amount;
        const payAmount = amount ? parseFloat(amount) : remaining;

        if (payAmount <= 0) return res.status(400).json({ success: false, message: 'Valor inválido.' });
        if (payAmount > remaining + 0.01) return res.status(400).json({ success: false, message: 'O valor pago excede o saldo devedor.' });

        const newPaidAmount = tx.paid_amount + payAmount;
        const newStatus = (newPaidAmount + 0.01) >= tx.amount ? 'completed' : 'partial';

        // Insere no histórico de pagamentos
        await supabase.from('transaction_payments').insert({
            transaction_id: tx.id, account_id: account_id || null, amount: payAmount, payment_method: payment_method || 'cash', payment_date: payDate
        });

        // Atualiza a transação
        await supabase.from('transactions').update({
            status: newStatus, paid_amount: newPaidAmount, payment_date: payDate, payment_method: payment_method || 'cash'
        }).eq('id', tx.id);

        // Atualiza o saldo da conta
        if (account_id) {
            const { data: acc } = await supabase.from('bank_accounts').select('current_balance').eq('id', account_id).single();
            if (acc) {
                const newBal = tx.type === 'income' ? acc.current_balance + payAmount : acc.current_balance - payAmount;
                await supabase.from('bank_accounts').update({ current_balance: newBal }).eq('id', account_id);
            }
        }

        res.json({ success: true, message: tx.type === 'income' ? 'Recebimento confirmado!' : 'Pagamento confirmado!' });
    } catch (error) {
        console.error('Erro ao baixar transacao:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar transação.' });
    }
});

/**
 * PUT /api/finance/transactions/:id
 * Update transaction details
 */
router.put('/transactions/:id', async (req, res) => {
    try {
        const { description, category_id, due_date, notes, barcode } = req.body;
        const { data: tx } = await supabase.from('transactions').select('*').eq('id', req.params.id).maybeSingle();
        
        if (!tx) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });
        
        await supabase.from('transactions').update({
            description: description || tx.description,
            category_id: category_id || tx.category_id,
            due_date: due_date || tx.due_date,
            notes: notes !== undefined ? notes : tx.notes,
            barcode: barcode !== undefined ? barcode : tx.barcode,
            updated_at: new Date().toISOString()
        }).eq('id', tx.id);

        res.json({ success: true, message: 'Transação atualizada com sucesso!' });
    } catch (error) {
        console.error('Erro ao editar transacao:', error);
        res.status(500).json({ success: false, message: 'Erro ao editar transação.' });
    }
});

/**
 * POST /api/finance/transactions/:id/upload
 * Upload an attachment
 */
router.post('/transactions/:id/upload', upload.single('attachment'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, message: 'Nenhum arquivo enviado.' });

        const { data: tx } = await supabase.from('transactions').select('*').eq('id', req.params.id).maybeSingle();
        if (!tx) return res.status(404).json({ success: false, message: 'Transação não encontrada.' });

        const ext = path.extname(req.file.originalname).toLowerCase();
        const fileName = `tx_${tx.id}_${Date.now()}${ext}`;

        // Tentar excluir anexo antigo (seja local ou do bucket)
        if (tx.attachment_path) {
            if (tx.attachment_path.startsWith('http')) {
                // Arquivo está no Supabase
                try {
                    const urlObj = new URL(tx.attachment_path);
                    const pathParts = urlObj.pathname.split('/');
                    const oldFileName = pathParts[pathParts.length - 1];
                    await supabase.storage.from('uploads').remove([oldFileName]);
                } catch (e) { /* ignore parse error */ }
            } else {
                // Arquivo local (caminho antigo)
                const oldPath = path.join(__dirname, '../../public', tx.attachment_path);
                if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
            }
        }

        // Fazer upload do buffer direto para o Supabase Storage
        const { error: uploadError } = await supabase.storage.from('uploads')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Pegar URL pública da imagem
        const { data: urlData } = supabase.storage.from('uploads').getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        await supabase.from('transactions').update({ attachment_path: publicUrl }).eq('id', tx.id);

        res.json({ success: true, message: 'Anexo salvo com sucesso!', attachment_path: publicUrl });
    } catch (error) {
        console.error('Erro no upload:', error);
        res.status(500).json({ success: false, message: 'Erro ao salvar anexo.' });
    }
});

/**
 * DELETE /api/finance/transactions/:id
 * Delete a transaction
 */
router.delete('/transactions/:id', async (req, res) => {
    try {
        const { data: tx } = await supabase.from('transactions').select('type').eq('id', req.params.id).maybeSingle();
        if (tx) {
            const { data: payments } = await supabase.from('transaction_payments').select('account_id, amount').eq('transaction_id', req.params.id);
            for (const p of (payments || [])) {
                if (p.account_id) {
                    const { data: acc } = await supabase.from('bank_accounts').select('current_balance').eq('id', p.account_id).single();
                    if (acc) {
                        const newBal = tx.type === 'income' ? acc.current_balance - p.amount : acc.current_balance + p.amount;
                        await supabase.from('bank_accounts').update({ current_balance: newBal }).eq('id', p.account_id);
                    }
                }
            }
        }
        await supabase.from('transactions').delete().eq('id', req.params.id);
        res.json({ success: true, message: 'Excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir transacao:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir conta bancária.' });
    }
});

// =============================================
// TRANSAÇÕES RECORRENTES (API)
// =============================================

/**
 * GET /api/finance/recurring
 * List recurring transactions
 */
router.get('/recurring', async (req, res) => {
    try {
        const { data: recurring, error } = await supabase
            .from('recurring_transactions')
            .select('*, transaction_categories(name, color), bank_accounts(name)')
            .order('day_of_month', { ascending: true });
        if (error) throw error;
        
        const recFormat = (recurring || []).map(r => ({
            ...r,
            category_name: r.transaction_categories?.name,
            category_color: r.transaction_categories?.color,
            account_name: r.bank_accounts?.name
        }));
        
        res.json({ success: true, data: recFormat });
    } catch (error) {
        console.error('Erro ao listar recorrências:', error);
        res.status(500).json({ success: false, message: 'Erro ao listar recorrências.' });
    }
});

/**
 * POST /api/finance/recurring
 * Create new recurring transaction
 */
router.post('/recurring', async (req, res) => {
    try {
        const { type, category_id, account_id, description, amount, day_of_month, notes } = req.body;
        
        if (!type || !description || !amount || !day_of_month) {
            return res.status(400).json({ success: false, message: 'Preencha todos os campos obrigatórios.' });
        }

        const { data: info, error } = await supabase.from('recurring_transactions').insert({
            type, category_id: category_id || null, account_id: account_id || null, description: description.trim(), amount, day_of_month, notes: notes ? notes.trim() : '', status: 'active'
        }).select('id').single();
        if (error) throw error;

        res.status(201).json({ success: true, message: 'Transação recorrente criada!', data: { id: info.id } });
    } catch (error) {
        console.error('Erro ao criar recorrência:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar transação recorrente.' });
    }
});

/**
 * PUT /api/finance/recurring/:id
 * Update recurring transaction
 */
router.put('/recurring/:id', async (req, res) => {
    try {
        const { type, category_id, account_id, description, amount, day_of_month, notes, status } = req.body;
        
        const { data: existing } = await supabase.from('recurring_transactions').select('id').eq('id', req.params.id).maybeSingle();
        if (!existing) return res.status(404).json({ success: false, message: 'Recorrência não encontrada.' });

        await supabase.from('recurring_transactions').update({
            type, category_id: category_id || null, account_id: account_id || null, description: description.trim(), amount, day_of_month, notes: notes ? notes.trim() : '', status: status || 'active', updated_at: new Date().toISOString()
        }).eq('id', req.params.id);

        res.json({ success: true, message: 'Recorrência atualizada com sucesso.' });
    } catch (error) {
        console.error('Erro ao atualizar recorrência:', error);
        res.status(500).json({ success: false, message: 'Erro ao atualizar recorrência.' });
    }
});

/**
 * DELETE /api/finance/recurring/:id
 * Delete recurring transaction
 */
router.delete('/recurring/:id', async (req, res) => {
    try {
        const { data: existing } = await supabase.from('recurring_transactions').select('id').eq('id', req.params.id).maybeSingle();
        if (!existing) return res.status(404).json({ success: false, message: 'Recorrência não encontrada.' });

        await supabase.from('recurring_transactions').delete().eq('id', req.params.id);
        res.json({ success: true, message: 'Recorrência excluída.' });
    } catch (error) {
        console.error('Erro ao excluir recorrência:', error);
        res.status(500).json({ success: false, message: 'Erro ao excluir recorrência.' });
    }
});

module.exports = router;
