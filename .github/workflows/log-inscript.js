

// Function to switch between Login, Register, and Forgot forms
function switchForm(formId, mode) {
    // Hide all forms
    document.querySelectorAll('.auth-form').forEach(form => {
        form.classList.remove('active');
    });

    // Show selected form
    document.getElementById(formId).classList.add('active');

    // Optional: Change the background image based on the mode
    const panel = document.getElementById('graphic-panel');
    if (mode === 'register') {
        panel.style.backgroundImage = "url('https://via.placeholder.com/500/fcd7d9/ff7597?text=Registration+Art')";
    } else if (mode === 'forgot') {
        panel.style.backgroundImage = "url('https://via.placeholder.com/500/fcd7d9/ff7597?text=Password+Reset')";
    } else {
        panel.style.backgroundImage = "url('https://via.placeholder.com/500/fcd7d9/ff7597?text=Welcome+Back')";
    }
}

// Function to toggle password visibility
function togglePass(id) {
    const input = document.getElementById(id);
    const icon = input.nextElementSibling;
    
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

function handleForgotPassword() {
    const email = document.getElementById('forgot-email').value.trim();
    if (!email) {
        alert('Please enter your email address');
        return;
    }
    // Simulate sending a reset link and transition to the confirm code view.
    switchForm('confirm-form', 'confirm');
}

function handleConfirmCode() {
    const code = document.getElementById('confirm-code').value.trim();
    if (!code) {
        alert('Please enter the confirmation code sent to your email');
        return;
    }
    // In a real app, verify the code on the server here.
    switchForm('new-password-form', 'newPassword');
}

function handleResendCode() {
    alert('A new code has been sent to your email.');
}

function handleSavePassword() {
    const password = document.getElementById('new-pass-field').value.trim();
    const confirmPassword = document.getElementById('confirm-new-pass').value.trim();
    if (!password || !confirmPassword) {
        alert('Please fill out both password fields');
        return;
    }
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    alert('Your password has been updated successfully. Redirecting to dashboard...');

    // Simulate a successful reset and auto-login
    localStorage.setItem('loggedIn', 'true');
    if (!localStorage.getItem('username')) {
        localStorage.setItem('username', 'user');
    }
    window.location.href = 'dashboard (1).html';
}

// Handle login form submission
document.addEventListener('DOMContentLoaded', function() {
    document.body.style.backgroundColor = '#0b66c3';
    
    // Get login form and add submit handler
    const loginForm = document.querySelector('#login-form form');
    if (loginForm) {
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get username and password values
            const username = loginForm.querySelector('input[type="text"]').value.trim();
            const password = loginForm.querySelector('input[type="password"]').value.trim();
            
            // Basic validation
            if (!username || !password) {
                alert('Please enter both username and password');
                return;
            }
            
            // Simple validation (you can add backend authentication later)
            if (username && password.length >= 4) {
                // Set logged in status in localStorage
                localStorage.setItem('loggedIn', 'true');
                localStorage.setItem('username', username);
                
                // Redirect to dashboard
                window.location.href = 'dashboard (1).html';
            } else {
                alert('Invalid username or password');
            }
        });
    }
});