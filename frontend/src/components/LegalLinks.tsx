const PRIVACY_POLICY_URL =
  "https://docs.google.com/document/d/1KCuiM_1VPATLe-pHH6ZT1Cy3djBtI2hJK47_4G0x2E4/preview";
const TERMS_URL =
  "https://docs.google.com/document/d/1arjAdtOgWD_DF_v15vKhSq-tMSu3kVJ87V2_2wK-jDU/preview";
const PRIVACY_POLICY_LABEL =
  "\u041f\u043e\u043b\u0438\u0442\u0438\u043a\u0430 \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0438 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u043b\u044c\u043d\u044b\u0445 \u0434\u0430\u043d\u043d\u044b\u0445";
const TERMS_LABEL =
  "\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c\u0441\u043a\u043e\u0435 \u0441\u043e\u0433\u043b\u0430\u0448\u0435\u043d\u0438\u0435";

interface LegalLinksProps {
  className?: string;
}

function LegalLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" title={label} aria-label={label}>
      {label}
    </a>
  );
}

export function PrivacyPolicyLink() {
  return <LegalLink href={PRIVACY_POLICY_URL} label={PRIVACY_POLICY_LABEL} />;
}

export function TermsLink() {
  return <LegalLink href={TERMS_URL} label={TERMS_LABEL} />;
}

export function LegalLinks({ className = "" }: LegalLinksProps) {
  const normalizedClassName = className.trim();

  return (
    <span className={normalizedClassName || undefined}>
      <PrivacyPolicyLink />
      {" | "}
      <TermsLink />
    </span>
  );
}
