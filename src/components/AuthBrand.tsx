import Image from "next/image";

export default function AuthBrand() {
  return (
    <div className="auth-brand" aria-label="Nexo Clínico, versión 1">
      <Image
        className="auth-brand-mark"
        src="/nexo-clinico-logo.svg"
        alt=""
        width={54}
        height={54}
        priority
      />
      <div className="auth-brand-copy">
        <span className="auth-brand-name">Nexo Clínico</span>
        <span className="auth-brand-subtitle">Gestión clínica integral</span>
      </div>
      <span className="auth-version">V1</span>
    </div>
  );
}
