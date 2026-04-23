export default function Home() {
  return (
    <div style={{ padding: "50px", textAlign: "center", fontFamily: "sans-serif" }}>
      <h1>Prueba de Supervivencia</h1>
      <p>Si ves esto, el servidor de Vercel está vivo.</p>
      <hr />
      <p>ID de Despliegue: {new Date().toISOString()}</p>
    </div>
  );
}
