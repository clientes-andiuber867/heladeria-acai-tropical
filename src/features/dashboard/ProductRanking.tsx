import { useEffect, useState } from "react";
import { Modal } from "../../components/Modal";
import { Loading, Empty, ErrorState } from "../../components/States";
import { getProductRanking, type RankedProduct } from "../../services/sales";
import { money, errorMessage } from "../../lib/format";
export function ProductRanking({
  from,
  to,
  onClose,
}: {
  from: string;
  to: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<RankedProduct[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    getProductRanking(from, to)
      .then((r) => {
        if (active) {
          setRows(r);
          setError("");
        }
      })
      .catch((e) => {
        if (active) setError(errorMessage(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [from, to, revision]);
  return (
    <Modal
      title="Ranking completo de productos"
      className="ranking-dialog"
      onClose={onClose}
    >
      <div className="insight-heading">
        <div>
          <span className="insight-kicker">RENDIMIENTO DE PRODUCTOS</span>
          <h2>Ranking de productos</h2>
        </div>
      </div>
      <p className="muted">
        Del {from.split("-").reverse().join("/")} al{" "}
        {to.split("-").reverse().join("/")}. Ordenado por unidades vendidas.
      </p>
      <p className="fine-print">
        Solo ventas completadas. Incluye productos sin ventas; los archivados o eliminados
        aparecen si tuvieron ventas en este período.
      </p>
      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} retry={() => setRevision((v) => v + 1)} />
      ) : !rows.length ? (
        <Empty title="No hay productos para mostrar" />
      ) : (
        <div className="ranking-scroll">
          <div className="ranking-columns" aria-hidden="true">
            <span>POS.</span>
            <span>PRODUCTO</span>
            <span>UNIDADES</span>
            <span>VENTAS</span>
          </div>
          {rows.map((p, i) => (
            <div
              className={`favorite-item ${i === 0 && Number(p.quantity) > 0 ? "favorite-leader" : ""}`}
              key={p.id}
            >
              <span className="favorite-place">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="favorite-info">
                <strong>{p.name}</strong>
              </div>
              <div className="favorite-count">
                <strong>{p.quantity}</strong>
                <small>
                  {Number(p.quantity) === 1 ? "vendido" : "vendidos"}
                </small>
              </div>
              <div className="rank-sales">{money(p.total)}</div>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
