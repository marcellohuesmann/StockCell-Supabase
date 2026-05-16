const supabase = require('../database/supabase');

/**
 * Verifica todas as transações recorrentes ativas e gera
 * a transação financeira correspondente para o mês atual, se ainda não existir.
 */
async function checkAndGenerateRecurringTransactions() {
    try {
        const now = new Date();
        const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Busca todas as recorrências ativas
        const { data: recurrences, error } = await supabase.from('recurring_transactions').select('*').eq('status', 'active');
        if (error) throw error;

        let generatedCount = 0;

        for (const rec of (recurrences || [])) {
            // Checa se o mês atual já foi gerado
            if (rec.last_generated_month === currentMonth) {
                continue; // já gerado neste mês
            }

            const dueDateObj = new Date(now.getFullYear(), now.getMonth(), rec.day_of_month);
            if (dueDateObj.getMonth() !== now.getMonth()) {
                dueDateObj.setDate(0); // Último dia do mês alvo
            }

            const dueDateStr = `${dueDateObj.getFullYear()}-${String(dueDateObj.getMonth() + 1).padStart(2, '0')}-${String(dueDateObj.getDate()).padStart(2, '0')}`;

            // Inserir a nova transaction pendente
            const { error: txError } = await supabase.from('transactions').insert({
                category_id: rec.category_id,
                type: rec.type,
                description: rec.description,
                amount: rec.amount,
                status: 'pending',
                due_date: dueDateStr,
                reference_type: 'recurring',
                reference_id: rec.id,
                notes: rec.notes
            });
            if (txError) throw txError;

            // Atualizar o last_generated_month
            const { error: upError } = await supabase.from('recurring_transactions').update({
                last_generated_month: currentMonth,
                updated_at: new Date().toISOString()
            }).eq('id', rec.id);
            if (upError) throw upError;

            generatedCount++;
        }

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
