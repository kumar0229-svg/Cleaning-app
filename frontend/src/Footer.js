import React from "react";

function Footer() {
  return (
    <div style={styles.footer}>
      Developed by Kumar
    </div>
  );
}

const styles = {
  footer: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: "#004f9f",
    color: "white",
    textAlign: "center",
    padding: "8px 16px",
    fontSize: "12px",
    fontWeight: "bold",
    letterSpacing: "0.3px",
    zIndex: 9000,
  },
};

export default Footer;
