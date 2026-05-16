const { getDatabase } = require('../database/init');

/**
 * Verifica todas as transações recorrentes ativas e gera
 * a transação financeira correspondente para o mês atual, se ainda não existir.
 */
function checkAndGenerateRecurringTransactions() {
    try {
        const db = getDatabase();
        
        // Pega o mês e ano atual no formato YYYY-MM
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const currentDay = now.getDate(); // dia de hoje

        // Busca todas as recorrências ativas
        const recurrences = db.prepare(`
            SELECT * FROM recurring_transactions 
            WHERE status = 'active'
        `).all();

        const insertTx = db.prepare(`
            INSERT INTO transactions (category_id, type, description, amount, status, due_date, reference_type, reference_id, notes)
            VALUES (?, ?, ?, ?, 'pending', ?, 'recurring', ?, ?)
        `);
        
        const updateRecurrence = db.prepare(`
            UPDATE recurring_transactions SET last_generated_month = ?, updated_at = datetime('now','localtime') WHERE id = ?
        `);

        let generatedCount = 0;

        db.transaction(() => {
            for (const rec of recurrences) {
                // Checa se o mês atual já foi gerado
                if (rec.last_generated_month === currentMonth) {
                    continue; // já gerado neste mês
                }

                // Só gerar se o dia atual já passou ou é o próprio dia de vencimento,
                // OU a regra de negócio permite gerar no início do mês:
                // Vamos gerar no início do mês ou assim que acessar e perceber que não foi gerado pro mês vigente, 
                // idependente de currentDay >= rec.day_of_month. Isso garante que as contas do mês já fiquem "A Pagar".
                
                // Monta a data de vencimento (YYYY-MM-DD) usando o dia cadastrado.
                // Cuida do caso onde dia é 31 e o mês tem 30 dias.
                const dueDateObj = new Date(now.getFullYear(), now.getMonth(), rec.day_of_month);
                // Se o mês mudou no objeto Date (ex: 31 fev -> 3 mar), significa que o dia excedeu os dias do mês.
                // A gente pode ajustar para o último dia do mês correto
                if (dueDateObj.getMonth() !== now.getMonth()) {
                    dueDateObj.setDate(0); // Último dia do mês alvo
                }

                const dueDateStr = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}-${String(dueDateObj.getDate()).padStart(2, '0')}`;

                // Inserir a nova transaction pendente
                insertTx.run(
                    rec.category_id,
                    rec.type,
                    rec.description, // Ex: Aluguel (Mensal)
                    rec.amount,
                    dueDateStr,
                    rec.id,
                    rec.notes
                );

                // Atualizar o last_generated_month
                updateRecurrence.run(currentMonth, rec.id);
                generatedCount++;
            }
        })();

        if (generatedCount > 0) {
            console.log(`✅ [Recorrências] Foram geradas ${generatedCount} novas transações para o mês de ${currentMonth}.`);
        }

    } catch (error) {
        console.error('❌ [Recorrências] Erro ao gerar transações recorrentes:', error);
    }
}

/**
 * Inicia o agendamento de verificação diária.
 */
function startRecurrenceScheduler() {
    console.log('⏰ Rotina de Transações Recorrentes iniciada.');
    
    // Roda imediatamente na inicialização
    checkAndGenerateRecurringTransactions();

    // Roda a cada 24 horas (em ms)
    const intervalMs = 24 * 60 * 60 * 1000;
    setInterval(() => {
        checkAndGenerateRecurringTransactions();
    }, intervalMs);
}

module.exports = {
    checkAndGenerateRecurringTransactions,
    startRecurrenceScheduler
};
