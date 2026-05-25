import React from "react";

function Pagination({ total, page, pageSize, onPage }) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  const pages = [];
  const delta = 2;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== "...") {
      pages.push("...");
    }
  }

  return (
    <div style={styles.container}>
      <button onClick={() => onPage(page - 1)} disabled={page === 1} style={styles.btn}>
        Prev
      </button>
      {pages.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} style={styles.ellipsis}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPage(p)}
            style={p === page ? styles.activePage : styles.btn}
          >
            {p}
          </button>
        )
      )}
      <button onClick={() => onPage(page + 1)} disabled={page === totalPages} style={styles.btn}>
        Next
      </button>
      <span style={styles.info}>
        {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
    </div>
  );
}

const styles = {
  container: { display: "flex", gap: "4px", alignItems: "center", marginTop: "12px", flexWrap: "wrap" },
  btn:       { padding: "5px 10px", background: "#f1f5f9", color: "#333", border: "1px solid #e2e8f0", borderRadius: "4px", cursor: "pointer", fontSize: "12px" },
  activePage:{ padding: "5px 10px", background: "#004f9f", color: "white", border: "none", borderRadius: "4px", cursor: "default", fontSize: "12px", fontWeight: "bold" },
  ellipsis:  { padding: "5px 4px", fontSize: "12px", color: "#888" },
  info:      { marginLeft: "8px", fontSize: "12px", color: "#888" },
};

export default Pagination;
