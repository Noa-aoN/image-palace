/**
 * 問い合わせ先。**出どころは1つだけ。**
 *
 * 特定商取引法は、氏名・住所・電話番号を「請求があれば遅滞なく開示」で
 * 済ませることを認めているが、**請求を受け取る口があることが条件**。
 * ここが空だと、その運用そのものが成り立たない。
 *
 * 複数の画面にアドレスを直書きしない。散らすと、変えたときに片方が古いまま残る。
 */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || null

export const CONTACT_PENDING_LABEL = '準備中です。'
