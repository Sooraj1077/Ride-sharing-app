/**
 * script.js - Core frontend application logic.
 * Serves as a single-page controller using localStorage for state persistence.
 */

// ==========================================
// 0. SUPPRESS GOOGLE MAPS WARNING ALERTS
// ==========================================
(function() {
    const originalAlert = window.alert;
    window.alert = function(message) {
        if (typeof message === 'string' && (
            message.toLowerCase().includes("google maps") || 
            message.includes("can't load Google Maps correctly") || 
            message.includes("developers")
        ) && !message.includes("saved successfully")) {
            console.warn("Blocked Google Maps popup warning alert: ", message);
            return;
        }
        originalAlert(message);
    };

    // Watch for and automatically remove Google Maps API error popups/dialogs from the DOM
    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    if (node.classList.contains('gm-err-container') || 
                        node.querySelector('.gm-err-container') ||
                        node.querySelector('[class*="gm-err"]')) {
                        node.style.display = 'none';
                        try {
                            const errDivs = node.classList.contains('gm-err-container') ? [node] : node.querySelectorAll('.gm-err-container, [class*="gm-err"]');
                            errDivs.forEach(el => el.remove());
                        } catch (e) {}
                    }
                    if (node.textContent && node.textContent.includes("can't load Google Maps correctly")) {
                        node.style.display = 'none';
                        try { node.remove(); } catch (e) {}
                    }
                }
            }
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true
    });

    // Also clean up any that might have loaded before DOMContentLoaded
    document.addEventListener("DOMContentLoaded", () => {
        document.querySelectorAll('.gm-err-container, [class*="gm-err"]').forEach(el => {
            el.style.display = 'none';
            try { el.remove(); } catch (e) {}
        });
    });
})();

// ==========================================
// 1. DATABASE SEED & PERSISTENCE HELPERS
// ==========================================
function initDatabase() {
    if (!localStorage.getItem("sr_users")) {
        localStorage.setItem("sr_users", JSON.stringify([]));
    }
    if (!localStorage.getItem("sr_rides")) {
        localStorage.setItem("sr_rides", JSON.stringify([]));
    }
    if (!localStorage.getItem("sr_payments")) {
        localStorage.setItem("sr_payments", JSON.stringify([]));
    }
    // Pre-seeded drivers matching Car, SUV, Bike
    if (!localStorage.getItem("sr_drivers")) {
        const defaultDrivers = [
            { id: 1, name: "John Doe", email: "john@driver.com", phone: "9876543210", password: "password123", vehicleType: "Car", vehicleNumber: "CAR-123", status: "Available", earnings: 0, trips: 0 },
            { id: 2, name: "Jane Smith", email: "jane@driver.com", phone: "9876543211", password: "password123", vehicleType: "SUV", vehicleNumber: "SUV-567", status: "Available", earnings: 0, trips: 0 },
            { id: 3, name: "Mike Johnson", email: "mike@driver.com", phone: "9876543212", password: "password123", vehicleType: "Bike", vehicleNumber: "BIKE-99", status: "Available", earnings: 0, trips: 0 }
        ];
        localStorage.setItem("sr_drivers", JSON.stringify(defaultDrivers));
    }
}

// Global active session variables
let currentUser = null;
let currentRole = null; // 'rider' or 'driver'
let activeOtp = null;
let pendingUserToVerify = null;
let activeIntervalId = null;

// Google Maps global state variables
let googleMapsLoaded = false;
let riderMap = null;
let driverMap = null;
let riderDirectionsService = null;
let riderDirectionsRenderer = null;
let driverDirectionsService = null;
let driverDirectionsRenderer = null;
let riderPickupAutocomplete = null;
let riderDropAutocomplete = null;
let riderMarkerPickup = null;
let riderMarkerDrop = null;
let riderCarMarker = null; // Animating car for rider
let driverCarMarker = null; // Animating car for driver
let driverMarkerPickup = null;
let driverMarkerDrop = null;

let currentRiderRouteDistance = 0; // in km
let lastRenderedRideId = null;
let lastRenderedStatus = null;
let lastRenderedJobId = null;
let lastRenderedJobStatus = null;

function loadGoogleMapsAPI() {
    return new Promise((resolve) => {
        if (window.google && window.google.maps) {
            resolve();
            return;
        }
        
        const savedKey = localStorage.getItem("sr_google_maps_key") || "";
        
        const existingScript = document.getElementById("google-maps-api-script");
        if (existingScript) {
            existingScript.remove();
        }
        
        window.initGoogleMapsCallback = () => {
            googleMapsLoaded = true;
            resolve();
        };

        const script = document.createElement("script");
        script.id = "google-maps-api-script";
        script.src = `https://maps.googleapis.com/maps/api/js?key=${savedKey}&libraries=places&callback=initGoogleMapsCallback`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            console.error("Failed to load Google Maps script. Check key or connection.");
        };
        
        document.head.appendChild(script);
    });
}

function getModernMapStyles() {
    return [
        {
            "featureType": "water",
            "elementType": "geometry",
            "stylers": [{ "color": "#e9e9e9" }, { "lightness": 17 }]
        },
        {
            "featureType": "landscape",
            "elementType": "geometry",
            "stylers": [{ "color": "#f5f5f5" }, { "lightness": 20 }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#ffffff" }, { "lightness": 17 }]
        },
        {
            "featureType": "road.highway",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#ffffff" }, { "lightness": 29 }, { "weight": 0.2 }]
        },
        {
            "featureType": "road.arterial",
            "elementType": "geometry",
            "stylers": [{ "color": "#ffffff" }, { "lightness": 18 }]
        },
        {
            "featureType": "road.local",
            "elementType": "geometry",
            "stylers": [{ "color": "#ffffff" }, { "lightness": 16 }]
        },
        {
            "featureType": "poi",
            "elementType": "geometry",
            "stylers": [{ "color": "#f5f5f5" }, { "lightness": 21 }]
        },
        {
            "featureType": "poi.park",
            "elementType": "geometry",
            "stylers": [{ "color": "#dedede" }, { "lightness": 21 }]
        },
        {
            "elementType": "labels.text.stroke",
            "stylers": [{ "visibility": "on" }, { "color": "#ffffff" }, { "lightness": 16 }]
        },
        {
            "elementType": "labels.text.fill",
            "stylers": [{ "saturation": 36 }, { "color": "#333333" }, { "lightness": 40 }]
        },
        {
            "elementType": "labels.icon",
            "stylers": [{ "visibility": "off" }]
        },
        {
            "featureType": "transit",
            "elementType": "geometry",
            "stylers": [{ "color": "#f2f2f2" }, { "lightness": 19 }]
        },
        {
            "featureType": "administrative",
            "elementType": "geometry.fill",
            "stylers": [{ "color": "#fefefe" }, { "lightness": 20 }]
        },
        {
            "featureType": "administrative",
            "elementType": "geometry.stroke",
            "stylers": [{ "color": "#fefefe" }, { "lightness": 17 }, { "weight": 1.2 }]
        }
    ];
}

function initRiderMap() {
    if (!googleMapsLoaded || riderMap) return;
    
    const mapElement = document.getElementById("rider-map");
    if (!mapElement) return;

    const placeholder = mapElement.querySelector(".map-placeholder-text");
    if (placeholder) placeholder.remove();

    const defaultCenter = { lat: 40.7128, lng: -74.0060 };
    
    riderMap = new google.maps.Map(mapElement, {
        center: defaultCenter,
        zoom: 12,
        styles: getModernMapStyles(),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });

    riderDirectionsService = new google.maps.DirectionsService();
    riderDirectionsRenderer = new google.maps.DirectionsRenderer({
        map: riderMap,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: "#6366f1",
            strokeOpacity: 0.8,
            strokeWeight: 5
        }
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLoc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                riderMap.setCenter(userLoc);
                riderMap.setZoom(13);
            }
        );
    }

    initRiderAutocomplete();
}

function initRiderAutocomplete() {
    if (!googleMapsLoaded) return;

    const pickupInput = document.getElementById("book-pickup");
    const dropInput = document.getElementById("book-drop");

    if (!pickupInput || !dropInput) return;

    riderPickupAutocomplete = new google.maps.places.Autocomplete(pickupInput);
    riderDropAutocomplete = new google.maps.places.Autocomplete(dropInput);

    if (riderMap) {
        riderPickupAutocomplete.bindTo("bounds", riderMap);
        riderDropAutocomplete.bindTo("bounds", riderMap);
    }

    riderPickupAutocomplete.addListener("place_changed", () => {
        calculateRiderRoute();
    });

    riderDropAutocomplete.addListener("place_changed", () => {
        calculateRiderRoute();
    });
}

function calculateRiderRoute() {
    const pickup = document.getElementById("book-pickup").value.trim();
    const drop = document.getElementById("book-drop").value.trim();

    if (!pickup || !drop) return;

    if (!googleMapsLoaded || !riderDirectionsService) {
        handleRiderInputEstimate();
        return;
    }

    riderDirectionsService.route(
        {
            origin: pickup,
            destination: drop,
            travelMode: google.maps.TravelMode.DRIVING
        },
        (response, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                riderDirectionsRenderer.setDirections(response);
                
                if (riderMarkerPickup) riderMarkerPickup.setMap(null);
                if (riderMarkerDrop) riderMarkerDrop.setMap(null);

                const leg = response.routes[0].legs[0];
                
                riderMarkerPickup = new google.maps.Marker({
                    position: leg.start_location,
                    map: riderMap,
                    title: "Pickup Point",
                    icon: {
                        url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    }
                });

                riderMarkerDrop = new google.maps.Marker({
                    position: leg.end_location,
                    map: riderMap,
                    title: "Destination",
                    icon: {
                        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                    }
                });

                const distanceMeters = leg.distance.value;
                currentRiderRouteDistance = parseFloat((distanceMeters / 1000).toFixed(1));
                
                updateEstimatedFare(currentRiderRouteDistance);
            } else {
                console.warn("Directions request failed due to: " + status);
            }
        }
    );
}

function updateEstimatedFare(distance) {
    const vehicleType = document.querySelector('input[name="book-vehicle"]:checked').value;
    const rate = vehicleType === "Bike" ? 2.0 : (vehicleType === "Car" ? 5.0 : 8.0);
    const fare = (distance * rate).toFixed(2);

    document.getElementById("ride-est-dist").textContent = distance + " km";
    document.getElementById("ride-est-fare").textContent = "RE " + fare;
    document.getElementById("rider-fare-card").classList.remove("hidden");
}

function drawActiveRiderRoute(activeRide) {
    if (!googleMapsLoaded || !riderMap || !riderDirectionsService) return;
    
    if (lastRenderedRideId === activeRide.id && lastRenderedStatus === activeRide.status) {
        return;
    }
    
    lastRenderedRideId = activeRide.id;
    lastRenderedStatus = activeRide.status;

    const pickup = activeRide.pickupLocation;
    const drop = activeRide.dropLocation;

    riderDirectionsService.route(
        {
            origin: pickup,
            destination: drop,
            travelMode: google.maps.TravelMode.DRIVING
        },
        (response, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                riderDirectionsRenderer.setDirections(response);

                if (riderMarkerPickup) riderMarkerPickup.setMap(null);
                if (riderMarkerDrop) riderMarkerDrop.setMap(null);

                const leg = response.routes[0].legs[0];

                riderMarkerPickup = new google.maps.Marker({
                    position: leg.start_location,
                    map: riderMap,
                    title: "Pickup Point",
                    icon: {
                        url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    }
                });

                riderMarkerDrop = new google.maps.Marker({
                    position: leg.end_location,
                    map: riderMap,
                    title: "Dropoff Point",
                    icon: {
                        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                    }
                });

                if (activeRide.status === "Ongoing") {
                    animateCarAlongRoute(riderMap, riderDirectionsRenderer, riderMarkerPickup, riderMarkerDrop, true);
                } else {
                    if (riderCarMarker) {
                        riderCarMarker.setMap(null);
                        riderCarMarker = null;
                    }
                }
            }
        }
    );
}

function clearRiderMapRoute() {
    if (riderDirectionsRenderer) {
        riderDirectionsRenderer.setDirections({ routes: [] });
    }
    if (riderMarkerPickup) {
        riderMarkerPickup.setMap(null);
        riderMarkerPickup = null;
    }
    if (riderMarkerDrop) {
        riderMarkerDrop.setMap(null);
        riderMarkerDrop = null;
    }
    if (riderCarMarker) {
        riderCarMarker.setMap(null);
        riderCarMarker = null;
    }
    lastRenderedRideId = null;
    lastRenderedStatus = null;
}

function initDriverMap() {
    if (!googleMapsLoaded || driverMap) return;

    const mapElement = document.getElementById("driver-map");
    if (!mapElement) return;

    const placeholder = mapElement.querySelector(".map-placeholder-text");
    if (placeholder) placeholder.remove();

    const defaultCenter = { lat: 40.7128, lng: -74.0060 };

    driverMap = new google.maps.Map(mapElement, {
        center: defaultCenter,
        zoom: 12,
        styles: getModernMapStyles(),
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false
    });

    driverDirectionsService = new google.maps.DirectionsService();
    driverDirectionsRenderer = new google.maps.DirectionsRenderer({
        map: driverMap,
        suppressMarkers: true,
        polylineOptions: {
            strokeColor: "#10b981",
            strokeOpacity: 0.8,
            strokeWeight: 5
        }
    });

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const userLoc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                driverMap.setCenter(userLoc);
                driverMap.setZoom(13);
            }
        );
    }
}

function drawDriverJobRoute(activeJob) {
    if (!googleMapsLoaded || !driverMap || !driverDirectionsService) return;

    if (lastRenderedJobId === activeJob.id && lastRenderedJobStatus === activeJob.status) {
        return;
    }

    lastRenderedJobId = activeJob.id;
    lastRenderedJobStatus = activeJob.status;

    const pickup = activeJob.pickupLocation;
    const drop = activeJob.dropLocation;

    driverDirectionsService.route(
        {
            origin: pickup,
            destination: drop,
            travelMode: google.maps.TravelMode.DRIVING
        },
        (response, status) => {
            if (status === google.maps.DirectionsStatus.OK) {
                driverDirectionsRenderer.setDirections(response);

                if (driverMarkerPickup) driverMarkerPickup.setMap(null);
                if (driverMarkerDrop) driverMarkerDrop.setMap(null);

                const leg = response.routes[0].legs[0];

                driverMarkerPickup = new google.maps.Marker({
                    position: leg.start_location,
                    map: driverMap,
                    title: "Pickup Point",
                    icon: {
                        url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
                    }
                });

                driverMarkerDrop = new google.maps.Marker({
                    position: leg.end_location,
                    map: driverMap,
                    title: "Dropoff Point",
                    icon: {
                        url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png"
                    }
                });

                if (activeJob.status === "Ongoing") {
                    animateCarAlongRoute(driverMap, driverDirectionsRenderer, driverMarkerPickup, driverMarkerDrop, false);
                } else {
                    if (driverCarMarker) {
                        driverCarMarker.setMap(null);
                        driverCarMarker = null;
                    }
                }
            }
        }
    );
}

function clearDriverMapRoute() {
    if (driverDirectionsRenderer) {
        driverDirectionsRenderer.setDirections({ routes: [] });
    }
    if (driverMarkerPickup) {
        driverMarkerPickup.setMap(null);
        driverMarkerPickup = null;
    }
    if (driverMarkerDrop) {
        driverMarkerDrop.setMap(null);
        driverMarkerDrop = null;
    }
    if (driverCarMarker) {
        driverCarMarker.setMap(null);
        driverCarMarker = null;
    }
    lastRenderedJobId = null;
    lastRenderedJobStatus = null;
}

function animateCarAlongRoute(mapInstance, rendererInstance, startMarker, endMarker, isRider) {
    const directions = rendererInstance.getDirections();
    if (!directions) return;

    const path = directions.routes[0].overview_path;
    if (path.length === 0) return;

    let marker = isRider ? riderCarMarker : driverCarMarker;
    
    if (marker) marker.setMap(null);

    marker = new google.maps.Marker({
        position: path[0],
        map: mapInstance,
        title: "SwiftRide Vehicle",
        icon: {
            url: "https://maps.google.com/mapfiles/kml/pal4/icon62.png",
            scaledSize: new google.maps.Size(32, 32),
            anchor: new google.maps.Point(16, 16)
        }
    });

    if (isRider) riderCarMarker = marker;
    else driverCarMarker = marker;

    let step = 0;
    const numSteps = path.length;
    const stepInterval = Math.max(50, Math.floor(4000 / numSteps)); // takes ~4s to animate

    function move() {
        if (step >= numSteps) {
            if (marker) {
                marker.setMap(null);
                if (isRider) riderCarMarker = null;
                else driverCarMarker = null;
            }
            return;
        }

        if (marker) marker.setPosition(path[step]);
        mapInstance.panTo(path[step]);
        step++;
        setTimeout(move, stepInterval);
    }

    move();
}

function setupPresetLocations() {
    document.querySelectorAll(".preset-pill").forEach(pill => {
        pill.addEventListener("click", () => {
            const address = pill.dataset.loc;
            const pickupInput = document.getElementById("book-pickup");
            const dropInput = document.getElementById("book-drop");

            if (!pickupInput.value.trim()) {
                pickupInput.value = address;
                pickupInput.dispatchEvent(new Event("input"));
            } else {
                dropInput.value = address;
                dropInput.dispatchEvent(new Event("input"));
            }
            
            if (pickupInput.value.trim() && dropInput.value.trim()) {
                calculateRiderRoute();
            }
        });
    });
}


// ==========================================
// 2. VIEW CONTROLLER (SPA ROUTER)
// ==========================================
function showView(viewId) {
    document.querySelectorAll(".view-section").forEach(sec => sec.classList.add("hidden"));
    document.getElementById(viewId).classList.remove("hidden");
    
    // Manage active state in Header links
    document.querySelectorAll(".nav-link").forEach(link => link.classList.remove("active"));
    if (viewId === "view-home") document.getElementById("link-home").classList.add("active");
    if (viewId === "view-rider") document.getElementById("link-rider-dash").classList.add("active");
    if (viewId === "view-driver") document.getElementById("link-driver-dash").classList.add("active");

    // Close mobile hamburger menu if open
    const navMenu = document.getElementById("nav-menu");
    if (navMenu) navMenu.classList.remove("active");
}

// Sync Navbar based on Authentication status
function syncNavbarUI() {
    const linkLogin = document.getElementById("link-login");
    const linkRegister = document.getElementById("link-register");
    const linkRiderDash = document.getElementById("link-rider-dash");
    const linkDriverDash = document.getElementById("link-driver-dash");
    const profileMenu = document.getElementById("user-profile-menu");
    const navUsername = document.getElementById("nav-username");

    if (currentUser) {
        if (linkLogin) linkLogin.classList.add("hidden");
        if (linkRegister) linkRegister.classList.add("hidden");
        if (profileMenu) {
            profileMenu.classList.remove("hidden");
            navUsername.textContent = currentUser.name;
        }

        if (currentRole === "rider") {
            if (linkRiderDash) linkRiderDash.classList.remove("hidden");
            if (linkDriverDash) linkDriverDash.classList.add("hidden");
        } else {
            if (linkDriverDash) linkDriverDash.classList.remove("hidden");
            if (linkRiderDash) linkRiderDash.classList.add("hidden");
        }
    } else {
        if (linkLogin) linkLogin.classList.remove("hidden");
        if (linkRegister) linkRegister.classList.remove("hidden");
        if (profileMenu) profileMenu.classList.add("hidden");
        if (linkRiderDash) linkRiderDash.classList.add("hidden");
        if (linkDriverDash) linkDriverDash.classList.add("hidden");
    }
}

// ==========================================
// 3. AUTHENTICATION & OTP REGISTER LOGIC
// ==========================================

// Handle Register submit
document.getElementById("form-register").addEventListener("submit", (e) => {
    e.preventDefault();
    const role = document.querySelector('input[name="reg-role"]:checked').value;
    const name = document.getElementById("reg-name").value.trim();
    const email = document.getElementById("reg-email").value.trim();
    const phone = document.getElementById("reg-phone").value.trim();
    const password = document.getElementById("reg-password").value;
    const confirmPassword = document.getElementById("reg-confirm-password").value;

    if (password !== confirmPassword) {
        alert("Passwords do not match!");
        return;
    }

    if (role === "rider") {
        let riders = JSON.parse(localStorage.getItem("sr_users"));
        if (riders.some(u => u.email === email)) {
            alert("Email already registered!");
            return;
        }
        const newRider = { id: Date.now(), name, email, phone, password };
        riders.push(newRider);
        localStorage.setItem("sr_users", JSON.stringify(riders));
    } else {
        let drivers = JSON.parse(localStorage.getItem("sr_drivers"));
        if (drivers.some(d => d.email === email)) {
            alert("Email already registered!");
            return;
        }
        const vehicleType = document.getElementById("reg-vehicle-type").value;
        const vehicleNumber = document.getElementById("reg-vehicle-number").value.trim();
        
        if (!vehicleNumber) {
            alert("Vehicle license plate number is required for drivers!");
            return;
        }

        const newDriver = {
            id: Date.now(), name, email, phone, password,
            vehicleType, vehicleNumber, status: "Offline", earnings: 0, trips: 0
        };
        drivers.push(newDriver);
        localStorage.setItem("sr_drivers", JSON.stringify(drivers));
    }

    alert("Registration Successful! Please Log in.");
    document.getElementById("form-register").reset();
    document.getElementById("card-register").classList.add("hidden");
    document.getElementById("card-login").classList.remove("hidden");
});

// Handle Login submit with OTP generation alert
document.getElementById("form-login").addEventListener("submit", (e) => {
    e.preventDefault();
    const role = document.querySelector('input[name="login-role"]:checked').value;
    const email = document.getElementById("login-email").value.trim();
    const password = document.getElementById("login-password").value;

    let matchedUser = null;

    if (role === "rider") {
        const riders = JSON.parse(localStorage.getItem("sr_users"));
        matchedUser = riders.find(u => u.email === email && u.password === password);
    } else {
        const drivers = JSON.parse(localStorage.getItem("sr_drivers"));
        matchedUser = drivers.find(d => d.email === email && d.password === password);
    }

    if (!matchedUser) {
        alert("Invalid email credentials or password!");
        return;
    }

    // Generate random 4 digit security OTP
    activeOtp = Math.floor(1000 + Math.random() * 9000).toString();
    alert("Verification Code Security Alert:\nYour OTP is: " + activeOtp);

    // Save temporary details
    pendingUserToVerify = matchedUser;
    currentRole = role;

    // Direct to OTP entry form card
    document.getElementById("card-login").classList.add("hidden");
    document.getElementById("card-otp").classList.remove("hidden");
});

// Verify entered digits
document.getElementById("btn-verify-otp").addEventListener("click", () => {
    const digit1 = document.getElementById("otp1").value.trim();
    const digit2 = document.getElementById("otp2").value.trim();
    const digit3 = document.getElementById("otp3").value.trim();
    const digit4 = document.getElementById("otp4").value.trim();
    const enteredCode = digit1 + digit2 + digit3 + digit4;

    if (enteredCode === activeOtp) {
        // Authenticated!
        currentUser = pendingUserToVerify;
        localStorage.setItem("sr_session_user", JSON.stringify(currentUser));
        localStorage.setItem("sr_session_role", currentRole);

        alert("Access Granted! Loading your dashboard...");
        
        // Reset OTP inputs
        document.getElementById("otp1").value = "";
        document.getElementById("otp2").value = "";
        document.getElementById("otp3").value = "";
        document.getElementById("otp4").value = "";
        document.getElementById("card-otp").classList.add("hidden");

        syncNavbarUI();

        if (currentRole === "rider") {
            showView("view-rider");
            startRiderPolling();
        } else {
            showView("view-driver");
            startDriverPolling();
        }
    } else {
        alert("Verification code incorrect. Please try again.");
    }
});

// Resend OTP
document.getElementById("btn-resend-otp").addEventListener("click", () => {
    activeOtp = Math.floor(1000 + Math.random() * 9000).toString();
    alert("Verification Code Security Alert:\nYour Resent OTP is: " + activeOtp);
});

// Logout handler
document.getElementById("logout-btn").addEventListener("click", () => {
    if (currentRole === "driver" && currentUser) {
        // Turn driver offline before log out
        setDriverOffline(currentUser.id);
    }
    currentUser = null;
    currentRole = null;
    localStorage.removeItem("sr_session_user");
    localStorage.removeItem("sr_session_role");
    
    if (activeIntervalId) {
        clearInterval(activeIntervalId);
        activeIntervalId = null;
    }

    syncNavbarUI();
    showView("view-home");
});

// ==========================================
// 4. RIDER DASHBOARD OPERATIONS
// ==========================================

// Auto Fare estimator calculator as inputs are edited
function handleRiderInputEstimate() {
    const pickup = document.getElementById("book-pickup").value.trim();
    const drop = document.getElementById("book-drop").value.trim();
    const vehicleType = document.querySelector('input[name="book-vehicle"]:checked').value;

    if (pickup.length > 2 && drop.length > 2) {
        // Simulates distance mapping using character counts
        const distance = parseFloat(((pickup.length + drop.length) * 0.35).toFixed(1));
        const rate = vehicleType === "Bike" ? 2.0 : (vehicleType === "Car" ? 5.0 : 8.0);
        const fare = (distance * rate).toFixed(2);

        document.getElementById("ride-est-dist").textContent = distance + " km";
        document.getElementById("ride-est-fare").textContent = "RE " + fare;
        document.getElementById("rider-fare-card").classList.remove("hidden");
    } else {
        document.getElementById("rider-fare-card").classList.add("hidden");
    }
}

document.getElementById("book-pickup").addEventListener("input", handleRiderInputEstimate);
document.getElementById("book-drop").addEventListener("input", handleRiderInputEstimate);
document.querySelectorAll('input[name="book-vehicle"]').forEach(radio => {
    radio.addEventListener("change", () => {
        if (currentRiderRouteDistance > 0) {
            updateEstimatedFare(currentRiderRouteDistance);
        } else {
            handleRiderInputEstimate();
        }
    });
});

// Request Ride submit
document.getElementById("form-booking").addEventListener("submit", (e) => {
    e.preventDefault();
    const pickup = document.getElementById("book-pickup").value.trim();
    const drop = document.getElementById("book-drop").value.trim();
    const vehicleType = document.querySelector('input[name="book-vehicle"]:checked').value;
    
    const distanceText = document.getElementById("ride-est-dist").textContent;
    const fareText = document.getElementById("ride-est-fare").textContent;
    const fareVal = parseFloat(fareText.replace("RE ", ""));

    let rides = JSON.parse(localStorage.getItem("sr_rides"));
    
    // Check if rider already has active ride
    if (rides.some(r => r.userId === currentUser.id && !["Completed", "Paid", "Cancelled"].includes(r.status))) {
        alert("You already have an active ride request!");
        return;
    }

    const newRide = {
        id: Date.now(),
        userId: currentUser.id,
        userName: currentUser.name,
        userPhone: currentUser.phone,
        driverId: null,
        driverName: null,
        driverPhone: null,
        driverVehicle: null,
        pickupLocation: pickup,
        dropLocation: drop,
        vehicleType,
        fare: fareVal,
        status: "Pending",
        createdAt: new Date().toISOString()
    };

    rides.push(newRide);
    localStorage.setItem("sr_rides", JSON.stringify(rides));
    alert("Ride Requested! Searching for nearby drivers...");

    document.getElementById("form-booking").reset();
    document.getElementById("rider-fare-card").classList.add("hidden");
    currentRiderRouteDistance = 0;

    // Launch automated background driver matching simulation if no driver responds in 8 seconds
    triggerBackgroundDriverSimulator(newRide.id);

    syncRiderDashboardView();
});

// Rider cancels pending/accepted ride request
document.getElementById("btn-rider-cancel").addEventListener("click", () => {
    let rides = JSON.parse(localStorage.getItem("sr_rides"));
    const rideIdx = rides.findIndex(r => r.userId === currentUser.id && !["Completed", "Paid", "Cancelled"].includes(r.status));
    
    if (rideIdx !== -1) {
        const ride = rides[rideIdx];
        
        // If a driver was assigned, release them
        if (ride.driverId) {
            releaseDriverStatus(ride.driverId);
        }

        rides[rideIdx].status = "Cancelled";
        localStorage.setItem("sr_rides", JSON.stringify(rides));
        alert("Your ride booking was cancelled.");
        syncRiderDashboardView();
    }
});

// Rider payment execution
document.getElementById("btn-pay-now").addEventListener("click", () => {
    let rides = JSON.parse(localStorage.getItem("sr_rides"));
    const rideIdx = rides.findIndex(r => r.userId === currentUser.id && r.status === "Completed");

    if (rideIdx !== -1) {
        const ride = rides[rideIdx];
        const payMethod = document.querySelector('input[name="ride-payment-method"]:checked').value;
        const txnId = "TXN-" + Math.floor(100000 + Math.random() * 900000);

        // Save payment
        let payments = JSON.parse(localStorage.getItem("sr_payments"));
        payments.push({
            id: Date.now(),
            rideId: ride.id,
            amount: ride.fare,
            method: payMethod,
            transactionId: txnId
        });
        localStorage.setItem("sr_payments", JSON.stringify(payments));

        // Update ride to Paid
        rides[rideIdx].status = "Paid";
        localStorage.setItem("sr_rides", JSON.stringify(rides));

        // Trigger Modal Receipt Popup
        document.getElementById("receipt-txn-id").textContent = txnId;
        document.getElementById("receipt-method").textContent = payMethod;
        document.getElementById("receipt-amount").textContent = "RE " + ride.fare.toFixed(2);
        document.getElementById("payment-success-modal").classList.remove("hidden");

        syncRiderDashboardView();
    }
});

document.getElementById("btn-close-receipt").addEventListener("click", () => {
    document.getElementById("payment-success-modal").classList.add("hidden");
});

// Refresh view details
function syncRiderDashboardView() {
    if (currentRole !== "rider" || !currentUser) return;

    if (!riderMap && googleMapsLoaded) {
        initRiderMap();
    }

    const rides = JSON.parse(localStorage.getItem("sr_rides"));
    const activeRide = rides.find(r => r.userId === currentUser.id && !["Paid", "Cancelled"].includes(r.status));

    const activeCard = document.getElementById("card-rider-active-ride");
    const bookingCard = document.getElementById("card-booking-form");
    
    if (activeRide) {
        if (bookingCard) bookingCard.classList.add("hidden");
        activeCard.classList.remove("hidden");

        // Draw active route on map
        drawActiveRiderRoute(activeRide);

        document.getElementById("rider-active-status").textContent = activeRide.status;
        document.getElementById("track-pickup").textContent = activeRide.pickupLocation;
        document.getElementById("track-drop").textContent = activeRide.dropLocation;
        document.getElementById("track-fare").textContent = "RE " + activeRide.fare.toFixed(2);

        // Adjust badge styles
        const badge = document.getElementById("rider-active-status");
        badge.className = "badge";
        if (activeRide.status === "Pending") badge.classList.add("badge-warning");
        else if (activeRide.status === "Cancelled") badge.classList.add("badge-danger");
        else badge.classList.add("badge-success");

        const cancelBtn = document.getElementById("btn-rider-cancel");
        if (["Pending", "Accepted"].includes(activeRide.status)) {
            cancelBtn.classList.remove("hidden");
        } else {
            cancelBtn.classList.add("hidden");
        }

        // Show driver info if assigned
        const driverBox = document.getElementById("track-driver-box");
        if (activeRide.driverId) {
            document.getElementById("track-driver-name").textContent = activeRide.driverName;
            document.getElementById("track-driver-vehicle").textContent = activeRide.driverVehicle;
            document.getElementById("track-driver-phone").textContent = activeRide.driverPhone;
            driverBox.classList.remove("hidden");
        } else {
            driverBox.classList.add("hidden");
        }

        // Show payments box when trip completes
        const payBox = document.getElementById("rider-pay-box");
        if (activeRide.status === "Completed") {
            payBox.classList.remove("hidden");
        } else {
            payBox.classList.add("hidden");
        }
    } else {
        activeCard.classList.add("hidden");
        if (bookingCard) bookingCard.classList.remove("hidden");

        // Clear active route from map
        clearRiderMapRoute();
    }

    // Load logs
    const historyBody = document.getElementById("rider-history-table-body");
    const riderRides = rides.filter(r => r.userId === currentUser.id);

    historyBody.innerHTML = "";
    if (riderRides.length === 0) {
        historyBody.innerHTML = `<tr><td colspan="3" class="text-center text-muted">No rides logged.</td></tr>`;
        return;
    }

    riderRides.forEach(r => {
        let bClass = "badge-warning";
        if (["Paid", "Completed"].includes(r.status)) bClass = "badge-success";
        if (r.status === "Cancelled") bClass = "badge-danger";

        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>
                <div style="font-weight:600;">${r.pickupLocation}</div>
                <div style="font-size:0.75rem;color:var(--text-muted);">to ${r.dropLocation}</div>
            </td>
            <td><strong>RE ${r.fare.toFixed(2)}</strong></td>
            <td><span class="badge ${bClass}">${r.status}</span></td>
        `;
        historyBody.appendChild(tr);
    });
}

function startRiderPolling() {
    if (activeIntervalId) clearInterval(activeIntervalId);
    syncRiderDashboardView();
    // Polls localStorage changes every 2 seconds to support multiple tabs
    activeIntervalId = setInterval(syncRiderDashboardView, 2000);
}

// ==========================================
// 5. DRIVER DASHBOARD OPERATIONS
// ==========================================

function syncDriverDashboardView() {
    if (currentRole !== "driver" || !currentUser) return;

    if (!driverMap && googleMapsLoaded) {
        initDriverMap();
    }

    // Load stats
    const drivers = JSON.parse(localStorage.getItem("sr_drivers"));
    const updatedDriver = drivers.find(d => d.id === currentUser.id);
    if (updatedDriver) {
        currentUser = updatedDriver;
        document.getElementById("drv-earnings-lbl").textContent = "RE " + currentUser.earnings.toFixed(2);
        document.getElementById("drv-trips-lbl").textContent = currentUser.trips;
        document.getElementById("drv-name-lbl").textContent = currentUser.name;
        document.getElementById("drv-vehicle-lbl").textContent = `${currentUser.vehicleType} - ${currentUser.vehicleNumber}`;
    }

    const isOnline = document.getElementById("driver-duty-toggle").checked;
    const rides = JSON.parse(localStorage.getItem("sr_rides"));

    // Find if driver has an active accepted job
    const activeJob = rides.find(r => r.driverId === currentUser.id && ["Accepted", "Arrived", "Ongoing"].includes(r.status));

    const radarCard = document.getElementById("card-driver-radar");
    const activeJobCard = document.getElementById("card-driver-active-job");
    const requestsCard = document.getElementById("card-driver-requests-list");

    if (activeJob) {
        // Driver has active trip
        document.getElementById("driver-map-card").classList.remove("hidden");
        drawDriverJobRoute(activeJob);

        radarCard.classList.add("hidden");
        requestsCard.classList.add("hidden");
        activeJobCard.classList.remove("hidden");

        document.getElementById("job-rider-name").textContent = activeJob.userName;
        document.getElementById("job-rider-phone").textContent = activeJob.userPhone;
        document.getElementById("job-pickup").textContent = activeJob.pickupLocation;
        document.getElementById("job-drop").textContent = activeJob.dropLocation;
        document.getElementById("job-fare").textContent = "RE " + activeJob.fare.toFixed(2);

        // Control action button visibility based on progress
        const btnArrive = document.getElementById("btn-job-arrive");
        const btnStart = document.getElementById("btn-job-start");
        const btnComplete = document.getElementById("btn-job-complete");

        if (activeJob.status === "Accepted") {
            btnArrive.classList.remove("hidden");
            btnStart.classList.add("hidden");
            btnComplete.classList.add("hidden");
        } else if (activeJob.status === "Arrived") {
            btnArrive.classList.add("hidden");
            btnStart.classList.remove("hidden");
            btnComplete.classList.add("hidden");
        } else if (activeJob.status === "Ongoing") {
            btnArrive.classList.add("hidden");
            btnStart.classList.add("hidden");
            btnComplete.classList.remove("hidden");
        }

        // Bind clicks
        btnArrive.onclick = () => updateJobStatus(activeJob.id, "Arrived");
        btnStart.onclick = () => updateJobStatus(activeJob.id, "Ongoing");
        btnComplete.onclick = () => completeJob(activeJob.id);

    } else {
        activeJobCard.classList.add("hidden");

        if (isOnline) {
            document.getElementById("driver-map-card").classList.remove("hidden");
            clearDriverMapRoute();

            radarCard.classList.remove("hidden");
            requestsCard.classList.remove("hidden");

            // Load pending rider requests matching driver vehicle
            const pendingOffers = rides.filter(r => r.status === "Pending" && r.vehicleType === currentUser.vehicleType);
            const container = document.getElementById("driver-requests-container");
            container.innerHTML = "";

            if (pendingOffers.length === 0) {
                container.innerHTML = `<p class="text-center text-muted">No pending bookings matching ${currentUser.vehicleType} type.</p>`;
                return;
            }

            pendingOffers.forEach(o => {
                const item = document.createElement("div");
                item.className = "request-item-card";
                item.innerHTML = `
                    <div class="request-item-header">
                        <span>Passenger: ${o.userName}</span>
                        <span class="text-success">RE ${o.fare.toFixed(2)}</span>
                    </div>
                    <div class="ride-route-details">
                        <div class="route-line-decor">
                            <div class="dot green"></div>
                            <div class="line"></div>
                            <div class="dot red"></div>
                        </div>
                        <div class="route-text">
                            <div class="loc"><small>PICKUP</small><p>${o.pickupLocation}</p></div>
                            <div class="loc"><small>DROP</small><p>${o.dropLocation}</p></div>
                        </div>
                    </div>
                    <div class="request-actions">
                        <button class="btn btn-success btn-sm btn-accept" data-id="${o.id}">Accept</button>
                        <button class="btn btn-outline-danger btn-sm btn-reject" data-id="${o.id}">Reject</button>
                    </div>
                `;
                container.appendChild(item);
            });

            // Bind request actions
            container.querySelectorAll(".btn-accept").forEach(btn => {
                btn.addEventListener("click", () => acceptRideRequest(parseInt(btn.dataset.id)));
            });
            container.querySelectorAll(".btn-reject").forEach(btn => {
                btn.addEventListener("click", () => {
                    btn.closest(".request-item-card").remove();
                });
            });

        } else {
            document.getElementById("driver-map-card").classList.add("hidden");
            clearDriverMapRoute();

            radarCard.classList.add("hidden");
            requestsCard.classList.add("hidden");
        }
    }
}

// Set driver offline status
function setDriverOffline(driverId) {
    let drivers = JSON.parse(localStorage.getItem("sr_drivers"));
    const idx = drivers.findIndex(d => d.id === driverId);
    if (idx !== -1) {
        drivers[idx].status = "Offline";
        localStorage.setItem("sr_drivers", JSON.stringify(drivers));
    }
}

// Switch duty online/offline
document.getElementById("driver-duty-toggle").addEventListener("change", (e) => {
    const isOnline = e.target.checked;
    const label = document.getElementById("driver-duty-lbl");
    let drivers = JSON.parse(localStorage.getItem("sr_drivers"));
    const idx = drivers.findIndex(d => d.id === currentUser.id);

    if (idx !== -1) {
        drivers[idx].status = isOnline ? "Available" : "Offline";
        localStorage.setItem("sr_drivers", JSON.stringify(drivers));
        currentUser = drivers[idx];
    }

    if (isOnline) {
        label.textContent = "ONLINE";
        label.className = "status-text text-success";
    } else {
        label.textContent = "OFFLINE";
        label.className = "status-text text-muted";
    }

    syncDriverDashboardView();
});

// Driver accepts ride request
function acceptRideRequest(rideId) {
    let rides = JSON.parse(localStorage.getItem("sr_rides"));
    const rideIdx = rides.findIndex(r => r.id === rideId);

    if (rideIdx !== -1 && rides[rideIdx].status === "Pending") {
        // Set ride accepted
        rides[rideIdx].status = "Accepted";
        rides[rideIdx].driverId = currentUser.id;
        rides[rideIdx].driverName = currentUser.name;
        rides[rideIdx].driverPhone = currentUser.phone;
        rides[rideIdx].driverVehicle = `${currentUser.vehicleType} - ${currentUser.vehicleNumber}`;

        localStorage.setItem("sr_rides", JSON.stringify(rides));

        // Mark driver Busy
        let drivers = JSON.parse(localStorage.getItem("sr_drivers"));
        const drvIdx = drivers.findIndex(d => d.id === currentUser.id);
        if (drvIdx !== -1) {
            drivers[drvIdx].status = "Busy";
            localStorage.setItem("sr_drivers", JSON.stringify(drivers));
            currentUser = drivers[drvIdx];
        }

        alert("Trip Accepted! Proceed to pickup location.");
        syncDriverDashboardView();
    } else {
        alert("This booking is no longer available.");
    }
}

// Update trip status
function updateJobStatus(rideId, status) {
    let rides = JSON.parse(localStorage.getItem("sr_rides"));
    const idx = rides.findIndex(r => r.id === rideId);
    if (idx !== -1) {
        rides[idx].status = status;
        localStorage.setItem("sr_rides", JSON.stringify(rides));
        syncDriverDashboardView();
    }
}

// Complete trip
function completeJob(rideId) {
    let rides = JSON.parse(localStorage.getItem("sr_rides"));
    const idx = rides.findIndex(r => r.id === rideId);

    if (idx !== -1) {
        rides[idx].status = "Completed";
        localStorage.setItem("sr_rides", JSON.stringify(rides));

        // Update driver stats
        let drivers = JSON.parse(localStorage.getItem("sr_drivers"));
        const drvIdx = drivers.findIndex(d => d.id === currentUser.id);
        if (drvIdx !== -1) {
            drivers[drvIdx].status = "Available"; // Set back available
            drivers[drvIdx].trips += 1;
            drivers[drvIdx].earnings += rides[idx].fare;
            localStorage.setItem("sr_drivers", JSON.stringify(drivers));
            currentUser = drivers[drvIdx];
        }

        alert("Trip completed! Awaiting passenger payment.");
        syncDriverDashboardView();
    }
}

// Release driver status to available
function releaseDriverStatus(driverId) {
    let drivers = JSON.parse(localStorage.getItem("sr_drivers"));
    const idx = drivers.findIndex(d => d.id === driverId);
    if (idx !== -1) {
        drivers[idx].status = "Available";
        localStorage.setItem("sr_drivers", JSON.stringify(drivers));
    }
}

function startDriverPolling() {
    if (activeIntervalId) clearInterval(activeIntervalId);
    syncDriverDashboardView();
    activeIntervalId = setInterval(syncDriverDashboardView, 2000);
}

// ==========================================
// 6. AUTOMATED SIMULATION FLOW
// ==========================================
function triggerBackgroundDriverSimulator(rideId) {
    setTimeout(() => {
        let rides = JSON.parse(localStorage.getItem("sr_rides"));
        const ride = rides.find(r => r.id === rideId);

        // If ride status is still Pending, auto-accept it via simulated John Doe driver!
        if (ride && ride.status === "Pending") {
            const mockDriver = {
                id: 1,
                name: "John Doe (Simulated)",
                phone: "9876543210",
                vehicle: "Car - SIM-77-AA"
            };

            // 1. Accept
            ride.status = "Accepted";
            ride.driverId = mockDriver.id;
            ride.driverName = mockDriver.name;
            ride.driverPhone = mockDriver.phone;
            ride.driverVehicle = mockDriver.vehicle;
            localStorage.setItem("sr_rides", JSON.stringify(rides));
            syncRiderDashboardView();

            // 2. Arrived in 4 seconds
            setTimeout(() => {
                let rides2 = JSON.parse(localStorage.getItem("sr_rides"));
                const ride2 = rides2.find(r => r.id === rideId);
                if (ride2 && ride2.status === "Accepted") {
                    ride2.status = "Arrived";
                    localStorage.setItem("sr_rides", JSON.stringify(rides2));
                    syncRiderDashboardView();
                }

                // 3. Ongoing in 8 seconds
                setTimeout(() => {
                    let rides3 = JSON.parse(localStorage.getItem("sr_rides"));
                    const ride3 = rides3.find(r => r.id === rideId);
                    if (ride3 && ride3.status === "Arrived") {
                        ride3.status = "Ongoing";
                        localStorage.setItem("sr_rides", JSON.stringify(rides3));
                        syncRiderDashboardView();
                    }

                    // 4. Completed in 12 seconds
                    setTimeout(() => {
                        let rides4 = JSON.parse(localStorage.getItem("sr_rides"));
                        const ride4 = rides4.find(r => r.id === rideId);
                        if (ride4 && ride4.status === "Ongoing") {
                            ride4.status = "Completed";
                            localStorage.setItem("sr_rides", JSON.stringify(rides4));
                            syncRiderDashboardView();
                        }
                    }, 4000);

                }, 4000);

            }, 4000);
        }
    }, 8000);
}

// ==========================================
// 7. INITIALIZATION & ROUTING HOOKS
// ==========================================
window.addEventListener("DOMContentLoaded", () => {
    initDatabase();
    setupPresetLocations();

    // Load Google Maps API script
    loadGoogleMapsAPI().then(() => {
        if (currentUser) {
            if (currentRole === "rider") {
                initRiderMap();
            } else if (currentRole === "driver") {
                initDriverMap();
            }
        }
    });

    // Check if session exists in memory
    const savedUser = localStorage.getItem("sr_session_user");
    const savedRole = localStorage.getItem("sr_session_role");

    if (savedUser && savedRole) {
        currentUser = JSON.parse(savedUser);
        currentRole = savedRole;
        syncNavbarUI();

        if (currentRole === "rider") {
            showView("view-rider");
            startRiderPolling();
        } else {
            showView("view-driver");
            startDriverPolling();
        }
    } else {
        syncNavbarUI();
        showView("view-home");
    }
});

// Header link actions
document.getElementById("nav-logo").addEventListener("click", (e) => {
    e.preventDefault();
    if (!currentUser) showView("view-home");
});
document.getElementById("link-home").addEventListener("click", (e) => {
    e.preventDefault();
    showView("view-home");
});
document.getElementById("link-rider-dash").addEventListener("click", (e) => {
    e.preventDefault();
    showView("view-rider");
    startRiderPolling();
});
document.getElementById("link-driver-dash").addEventListener("click", (e) => {
    e.preventDefault();
    showView("view-driver");
    startDriverPolling();
});

// Click CTA Book
document.getElementById("cta-book-ride").addEventListener("click", () => {
    if (currentUser && currentRole === "rider") {
        showView("view-rider");
        startRiderPolling();
    } else {
        document.getElementById("login-role-rider").checked = true;
        document.getElementById("card-register").classList.add("hidden");
        document.getElementById("card-otp").classList.add("hidden");
        document.getElementById("card-login").classList.remove("hidden");
        showView("view-auth");
    }
});

// Click CTA Drive
document.getElementById("cta-drive").addEventListener("click", () => {
    if (currentUser && currentRole === "driver") {
        showView("view-driver");
        startDriverPolling();
    } else {
        document.getElementById("login-role-driver").checked = true;
        document.getElementById("card-register").classList.add("hidden");
        document.getElementById("card-otp").classList.add("hidden");
        document.getElementById("card-login").classList.remove("hidden");
        showView("view-auth");
    }
});

// Click Link Login
document.getElementById("link-login").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("card-register").classList.add("hidden");
    document.getElementById("card-otp").classList.add("hidden");
    document.getElementById("card-login").classList.remove("hidden");
    showView("view-auth");
});

// Click Link Register
document.getElementById("link-register").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("card-login").classList.add("hidden");
    document.getElementById("card-otp").classList.add("hidden");
    document.getElementById("card-register").classList.remove("hidden");
    showView("view-auth");
});

// Auth form toggles
document.getElementById("auth-link-register").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("card-login").classList.add("hidden");
    document.getElementById("card-register").classList.remove("hidden");
});

document.getElementById("auth-link-login").addEventListener("click", (e) => {
    e.preventDefault();
    document.getElementById("card-register").classList.add("hidden");
    document.getElementById("card-login").classList.remove("hidden");
});

// Toggle Driver fields in register card based on selection role
document.getElementById("reg-role-rider").addEventListener("change", () => {
    document.getElementById("reg-driver-fields").classList.add("hidden");
});
document.getElementById("reg-role-driver").addEventListener("change", () => {
    document.getElementById("reg-driver-fields").classList.remove("hidden");
});

// Mobile Hamburger Toggle Drawer
document.getElementById("nav-toggle-btn").addEventListener("click", () => {
    document.getElementById("nav-menu").classList.toggle("active");
});