export default function PaymentMethodCard({ method }) {
  return (
    <article className="list-card payment-card">
      <div className="list-card-top">
        <strong>{method.method_type.toUpperCase()}</strong>
        <span className="badge neutral">{method.label}</span>
      </div>
      <p>{method.value}</p>
      {method.account_reference ? <small>Account: {method.account_reference}</small> : null}
    </article>
  );
}
