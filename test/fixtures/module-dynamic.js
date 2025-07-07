console.log("Dynamically imported module imported");
document.getElementById("dynamic").innerText = "loaded";

if (window.loaded && window.domContentLoaded)
  fetch('/done');
