function handleCredentialResponse(response) {
    // Google sends back a JWT token
    const jwt = response.credential;

    console.log("JWT ID Token:", jwt);

    // Decode it (optional: only for front-end display)
    const payload = JSON.parse(atob(jwt.split('.')[1]));

    console.log("User Info:", payload, payload.email);

    localStorage.setItem("logged-in", true); // local storage is a bit insecure but for minimum viable product it shall suffice
    localStorage.setItem("google_jwt", jwt)

    window.location.replace("indext.html")
}
function loadIndextPage(){
    if (localStorage.getItem("logged-in") == null){
        return;
    }
    var jwt = localStorage.getItem("google_jwt");
    var payload = JSON.parse(atob(jwt.split('.')[1]));

    document.getElementById("userInfo").innerHTML = `
        <p class="right-aligned">Welcome, <strong>${payload.name}</strong></p>
        <img src="${payload.picture}" class="right-aligned"/>
    `;

    document.getElementById("signIn").remove();
}
function loadProfilePage(){
    console.log("Logged in :thumbsup:");

    var jwt = localStorage.getItem("google_jwt");
    var payload = JSON.parse(atob(jwt.split('.')[1]));

    document.getElementById("profile-name").innerHTML = payload.name;
    document.getElementById("profile-picture").innerHTML = `<img src="${payload.picture}"/>`
    document.getElementById("profile-email").innerHTML = payload.email;
}
function googleSignOut(){
    //google.accounts.id.disableAutoSelect();   // <-- KEY SIGN OUT
    localStorage.removeItem("google_jwt");
    localStorage.removeItem("logged-in");
    console.log("Signed out of this site.");

    window.location.replace("indext.html");
}