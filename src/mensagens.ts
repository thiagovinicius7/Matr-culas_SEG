/**
 * Mensagens prontas para a secretaria enviar pelo WhatsApp.
 * Texto editável na tela antes de enviar; aqui fica só o modelo.
 */

/** Primeiro nome (ou o nome todo, se for um só). */
const primeiroNome = (nome?: string) => (nome || '').trim().split(/\s+/)[0] || '';

/**
 * Famílias com parceria ou troca de serviços: a Carta de Intenção só vai depois da
 * conversa pessoal, para já refletir o que for combinado.
 */
export function mensagemParceria(nomeResponsavel?: string): string {
  const quem = primeiroNome(nomeResponsavel) || '[nome do responsável]';
  return (
    `Olá, ${quem}! Tudo bem?\n\n` +
    `Aqui é o Thiago, do Sítio-Escola Geranium. Estamos organizando a rematrícula de 2027 e vamos enviar a Carta de Intenção para as famílias.\n\n` +
    `Como a nossa parceria com vocês tem um formato especial, queremos conversar pessoalmente antes, para alinharmos como ela ficará em 2027. ` +
    `Por isso, a sua Carta será enviada só depois dessa conversa, e você não precisa se preocupar com ela por enquanto.\n\n` +
    `Quando seria um bom momento para nos encontrarmos? Me diga alguns dias e horários que funcionam para você, e eu organizo por aqui.\n\n` +
    `Um abraço!`
  );
}
