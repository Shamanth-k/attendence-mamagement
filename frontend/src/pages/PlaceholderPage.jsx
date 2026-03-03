function PlaceholderPage({ title }) {
  return (
    <div className="screen-card">
      <div className="section-head">
        <h2>{title}</h2>
      </div>
      <div className="placeholder-box">
        <p>{title} page is connected and ready for your next feature.</p>
      </div>
    </div>
  );
}

export default PlaceholderPage;
