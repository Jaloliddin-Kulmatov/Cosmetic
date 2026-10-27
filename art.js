// Mahsulot rasmi yo'q bo'lganda ko'rsatiladigan chizma tasvirlar.
(function (L) {
  function shapes(k, c) {
    var D1 = "#2b2b2b", GD = "#b8924a", S = "rgba(0,0,0,.14)";
    switch (k) {
      case "perfume": return '<rect x="46" y="30" width="8" height="10" fill="' + GD + '"/><rect x="38" y="13" width="24" height="19" rx="3" fill="' + GD + '"/><rect x="26" y="40" width="48" height="47" rx="7" fill="#fff" stroke="' + S + '"/><rect x="31" y="55" width="38" height="27" rx="3" fill="' + c + '" opacity=".6"/><rect x="38" y="62" width="24" height="12" rx="1" fill="#fff" opacity=".92"/>';
      case "mascara": return '<rect x="46" y="8" width="8" height="30" rx="4" fill="' + D1 + '"/><rect x="38" y="36" width="24" height="10" rx="2" fill="' + GD + '"/><rect x="38" y="46" width="24" height="42" rx="4" fill="' + c + '"/><rect x="42" y="58" width="16" height="12" rx="1" fill="#fff" opacity=".85"/>';
      case "lipstick": return '<polygon points="41,48 41,33 50,22 59,30 59,48" fill="' + c + '"/><rect x="38" y="48" width="24" height="10" fill="' + GD + '"/><rect x="38" y="58" width="24" height="29" rx="3" fill="' + D1 + '"/>';
      case "lipgloss": return '<rect x="40" y="12" width="20" height="20" rx="3" fill="' + GD + '"/><rect x="42" y="32" width="16" height="54" rx="7" fill="#fff" stroke="' + S + '"/><rect x="45" y="46" width="10" height="34" rx="5" fill="' + c + '" opacity=".75"/>';
      case "foundation": return '<rect x="40" y="14" width="20" height="9" rx="3" fill="' + D1 + '"/><rect x="46" y="23" width="8" height="21" fill="' + D1 + '"/><rect x="34" y="44" width="32" height="43" rx="6" fill="' + c + '"/><rect x="40" y="56" width="20" height="14" rx="1" fill="#fff" opacity=".85"/>';
      case "lashkit": return '<rect x="14" y="26" width="72" height="52" rx="4" fill="' + D1 + '"/><circle cx="34" cy="46" r="9" fill="' + c + '"/><circle cx="58" cy="46" r="9" fill="' + c + '" opacity=".7"/><rect x="24" y="62" width="52" height="5" rx="2" fill="#fff" opacity=".8"/>';
      case "cleanser": return '<rect x="40" y="12" width="20" height="18" rx="3" fill="' + D1 + '"/><rect x="34" y="30" width="32" height="57" rx="7" fill="' + c + '"/><rect x="39" y="48" width="22" height="18" rx="1" fill="#fff" opacity=".85"/>';
      case "serum": return '<rect x="44" y="8" width="12" height="26" rx="6" fill="' + D1 + '"/><rect x="38" y="32" width="24" height="8" rx="2" fill="' + GD + '"/><rect x="32" y="40" width="36" height="47" rx="7" fill="' + c + '" opacity=".9"/><rect x="38" y="56" width="24" height="16" rx="1" fill="#fff" opacity=".85"/>';
      case "cream": return '<rect x="22" y="40" width="56" height="14" rx="4" fill="' + GD + '"/><rect x="24" y="54" width="52" height="32" rx="6" fill="' + c + '"/><rect x="38" y="63" width="24" height="12" rx="1" fill="#fff" opacity=".85"/>';
      default: return '<rect x="20" y="34" width="60" height="50" rx="3" fill="' + c + '"/><rect x="46" y="34" width="8" height="50" fill="' + GD + '"/><circle cx="43" cy="30" r="7" fill="none" stroke="' + GD + '" stroke-width="3"/><circle cx="57" cy="30" r="7" fill="none" stroke="' + GD + '" stroke-width="3"/>';
    }
  }
  function art(k, c) { return '<svg viewBox="0 0 100 100" aria-hidden="true">' + shapes(k, c) + "</svg>"; }
  function scene(i) {
    var g = function (k, c, x, y, s) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')">' + shapes(k, c) + "</g>"; };
    var body = i === 0
      ? '<circle cx="150" cy="115" r="92" fill="#fff" opacity=".45"/>' + g("perfume", "#e3a9b2", 52, 8, 1.95)
      : '<circle cx="150" cy="115" r="92" fill="#fff" opacity=".45"/>' + g("serum", "#e8c98e", 6, 62, 1.25) + g("cream", "#e3a9b2", 96, 76, 1.1) + g("cleanser", "#cfe0d6", 174, 52, 1.35);
    return '<svg viewBox="0 0 300 230" aria-hidden="true">' + body + "</svg>";
  }

  L.art = art; L.scene = scene;
})(window.LIBER = window.LIBER || {});
