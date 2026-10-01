/**
 * Nº de operadores no payload do apontamento (`operatorCount`, nota de 01/10, § 3):
 *
 * | a tela manda    | o banco faz               |
 * |-----------------|---------------------------|
 * | não manda       | mantém o valor anterior   |
 * | 0               | apaga                     |
 * | um número       | grava                     |
 *
 * Campo vazio manda 0: quem salva o turno diz o que vale para ele, e vazio
 * quer dizer "não informado" — inclusive apagando um número salvo antes.
 */
export const operatorCountFor = (people: string): number => (people.trim() === "" ? 0 : Number(people));
