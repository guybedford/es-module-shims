console.log("Dynamically imported module imported");
document.getElementById("dynamic").innerText = "loaded";

if (window.domContentLoaded)
  fetch('/done');
