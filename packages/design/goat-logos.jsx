/* bokkiep — goat logo: exact ibex silhouette traced from reference, in brand orange */
function GoatLogo({ size = 34 }) {
  return (
    <img className="goat" src="assets/logo/ibex-orange.png" width={size} height={size}
      alt="" aria-hidden="true" style={{ display: "block", objectFit: "contain" }} />
  );
}
window.GoatLogo = GoatLogo;
