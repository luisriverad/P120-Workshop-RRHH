import React, { useState } from "react";
import ReactDOM from "react-dom/client";
import SaaSRRHH from "./SaaSRRHH.jsx";
import Login from "./Login.jsx";

// La pantalla de registro aparece una vez por sesión del navegador
const SESION_KEY = "rrhh.sesion.v1";
const yaEntro = () => {
  try { return sessionStorage.getItem(SESION_KEY) === "1"; } catch { return false; }
};

function App() {
  const [entro, setEntro] = useState(yaEntro);
  if (!entro) {
    return (
      <Login
        onEntrar={() => {
          try { sessionStorage.setItem(SESION_KEY, "1"); } catch { /* sin almacenamiento */ }
          window.scrollTo(0, 0);
          setEntro(true);
        }}
      />
    );
  }
  return <SaaSRRHH />;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
