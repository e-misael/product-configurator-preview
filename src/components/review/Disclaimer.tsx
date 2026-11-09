/**
 * The approved disclaimer (D-056, wording unchanged but TAAVI in capitals),
 * on its own between "Observação" and "Finalize seu pedido" (D-080).
 */
export function Disclaimer() {
  return (
    <div className="disclaimer">
      <p>
        A pré-visualização é ilustrativa. Como nossas peças são produzidas artesanalmente, o produto
        final pode apresentar pequenas variações de formato, textura, acabamento, posicionamento das
        letras e tonalidade das cores em relação à imagem exibida na tela.
      </p>
      <p>
        As cores também podem variar conforme a iluminação, as características da cerâmica e as
        configurações de cada dispositivo.
      </p>
      <p>Todas as solicitações de personalização estão sujeitas à análise e aprovação da TAAVI.</p>
    </div>
  );
}
