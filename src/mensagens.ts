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

/** Mensagem para famílias que marcaram "Em análise" na Carta e pediram conversa. */
export function mensagemReuniao(nomeResponsavel?: string, nomeAluno?: string, dataISO?: string, hora?: string): string {
  const primeiro = (nomeResponsavel || '').trim().split(/\s+/)[0];
  const saudacao = primeiro ? `Olá, ${primeiro}! Tudo bem?` : 'Olá! Tudo bem?';
  const aluno = nomeAluno ? ` sobre a rematrícula de ${nomeAluno.trim().split(/\s+/)[0]}` : '';
  let quando = '';
  if (dataISO) {
    const [a, m, d] = dataISO.split('-');
    quando = ` Podemos conversar no dia ${d}/${m}/${a}${hora ? ` às ${hora}` : ''}? Se não for um bom horário, me diga qual fica melhor para vocês.`;
  } else {
    quando = ' Me diga quais dias e horários ficam melhores para vocês que eu encaixo.';
  }
  return `${saudacao} Aqui é o Thiago, do Sítio-Escola Geranium. Vi que vocês marcaram "em análise" na Carta de Intenção e pediram para conversarmos${aluno}.${quando} Será um prazer ouvir vocês!`;
}

/** Lembrete para famílias que receberam a Carta de Intenção e ainda não responderam. */
export function mensagemLembreteCarta(nomeResponsavel: string | undefined, nomeAluno: string | undefined, ano: number, link: string): string {
  const primeiro = (nomeResponsavel || '').trim().split(/\s+/)[0];
  const saudacao = primeiro ? `Olá, ${primeiro}! Tudo bem?` : 'Olá! Tudo bem?';
  const aluno = nomeAluno ? ` de ${nomeAluno.trim().split(/\s+/)[0]}` : '';
  return `${saudacao} Aqui é o Thiago, do Sítio-Escola Geranium. Passando para lembrar com carinho da Carta de Intenção ${ano}${aluno}: ainda não recebemos a resposta de vocês. Ela leva só alguns minutos e nos ajuda a organizar as turmas do próximo ano.\n\n${link}\n\nSe tiver qualquer dúvida, é só me chamar!`;
}
