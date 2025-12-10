let lang = 'de';
// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', function() {
    initializeWebsite();
});

// Initialize all website functionality
function initializeWebsite() {
    initializeNavigation();
    initializeScrollEffects();
    initializeFormHandling();
    initializeModals();
    initializeScrollReveal();
    initializeLightbox();
    initializeHeroSlideshow();
    initializeLocationMap();
    initializeLazyLoading();
   lang = document.documentElement.lang;
}

// Navigation functionality
function initializeNavigation() {
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('nav-toggle');
    const navMenu = document.getElementById('nav-menu');
    const navLinks = document.querySelectorAll('.nav-link');

    // Mobile menu toggle
    if (navToggle && navMenu) {
        navToggle.addEventListener('click', function() {
            navToggle.classList.toggle('active');
            navMenu.classList.toggle('active');
        });
    }

    // Close mobile menu when clicking on nav links
    navLinks.forEach(link => {
        link.addEventListener('click', function() {
            if (navMenu && navToggle) {
                navMenu.classList.remove('active');
                navToggle.classList.remove('active');
            }
        });
    });

    // Navbar scroll effect
    let lastScrollTop = 0;
    window.addEventListener('scroll', function() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        
        if (navbar) {
            if (scrollTop > 100) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
        
        lastScrollTop = scrollTop;
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            
            if (target) {
                const navbarHeight = navbar ? navbar.offsetHeight : 0;
                const targetPosition = target.offsetTop - navbarHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Scroll effects and animations
function initializeScrollEffects() {
    // Parallax effect for hero section
    const heroBackground = document.querySelector('.hero-background');
    
    if (heroBackground) {
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const rate = scrolled * -0.5;
            
            if (scrolled <= window.innerHeight) {
                heroBackground.style.transform = `translateY(${rate}px)`;
            }
        });
    }

    // Animate elements on scroll
    const animateElements = document.querySelectorAll('.feature-card, .floorplan-card, .contact-detail, .location-feature');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 100);
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    animateElements.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(30px)';
        element.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
        observer.observe(element);
    });
}

// Form handling
function initializeFormHandling() {
    const contactForm = document.getElementById('contactForm');
    
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(contactForm);
            const formObject = {};
            
            formData.forEach((value, key) => {
                formObject[key] = value;
            });

            // Validate required fields
            const requiredFields = ['vorname', 'nachname', 'email', 'privacy'];
            let isValid = true;
            let errorMessage = '';

            requiredFields.forEach(field => {
                const input = contactForm.querySelector(`[name="${field}"]`);
                if (!input || !input.value.trim()) {
                    isValid = false;
                    if (input) {
                        input.style.borderColor = 'var(--error)';
                        setTimeout(() => {
                            input.style.borderColor = '';
                        }, 3000);
                    }
                }
            });

            // Email validation
            const emailInput = contactForm.querySelector('[name="email"]');
            if (emailInput && emailInput.value) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(emailInput.value)) {
                    isValid = false;
                    emailInput.style.borderColor = 'var(--error)';
                    setTimeout(() => {
                        emailInput.style.borderColor = '';
                    }, 3000);
                }
            }

            if (!isValid) {
                if(lang === 'en'){
                    showNotification('Please fill out all required fields correctly.', 'error');
                } else {
                    showNotification('Bitte füllen Sie alle Pflichtfelder korrekt aus.', 'error');
                }
                return;
            }

            // API submission
            const submitButton = contactForm.querySelector('button[type="submit"]');
            const originalText = submitButton.innerHTML;
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Wird gesendet...';

            fetch(
                'https://invest-pflege.azurewebsites.net/api/contact-form-civitano'
                //'http://localhost:7071/api/contact-form'
                , {
                method: 'POST',
                body: formData
            })
            //.then(response => response.json())
            .then(response => {
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
                if (response.ok) {
                    if(lang === 'en'){
                        showNotification('Thank you for your inquiry! We will get back to you shortly.', 'success');
                    } else {
                        showNotification('Vielen Dank für Ihre Anfrage! Wir melden uns in Kürze bei Ihnen.', 'success');
                    }
                    contactForm.reset();
                } else {
                    if(lang === 'en'){
                        showNotification('Error submitting the form. Please try again.', 'error');
                    } else {
                        showNotification('Fehler beim Senden des Formulars. Bitte versuchen Sie es erneut.', 'error');
                    }
                }
                console.log('Form submitted:', formObject);
            })
            .catch(error => {
                submitButton.disabled = false;
                submitButton.innerHTML = originalText;
                if(lang === 'en'){  
                    showNotification('Network error. Please try again later.', 'error');
                } else {
                    showNotification('Netzwerkfehler. Bitte versuchen Sie es später erneut.', 'error');
                }
                console.error('Form submission error:', error);
            });
        });

        // Real-time validation
        const inputs = contactForm.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', function() {
                validateField(input);
            });
            
            input.addEventListener('input', function() {
                // Clear error styling when user starts typing
                if (input.style.borderColor === 'var(--error)') {
                    input.style.borderColor = '';
                }
            });
        });
    }
}

// Field validation
function validateField(field) {
    const value = field.value.trim();
    let isValid = true;
    
    // Required field validation
    if (field.hasAttribute('required') && !value) {
        isValid = false;
    }
    
    // Email validation
    if (field.type === 'email' && value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            isValid = false;
        }
    }
    
    // Phone validation (basic)
    if (field.type === 'tel' && value) {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(value)) {
            isValid = false;
        }
    }
    
    // Visual feedback
    if (!isValid) {
        field.style.borderColor = 'var(--error)';
        field.style.boxShadow = '0 0 0 3px rgba(239, 68, 68, 0.1)';
    } else {
        field.style.borderColor = 'var(--success)';
        field.style.boxShadow = '0 0 0 3px rgba(16, 185, 129, 0.1)';
        
        // Clear success styling after 2 seconds
        setTimeout(() => {
            field.style.borderColor = '';
            field.style.boxShadow = '';
        }, 2000);
    }
    
    return isValid;
}

// Modal functionality
function initializeModals() {
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target.classList.contains('modal')) {
            closeModal(event.target.id);
        }
    });
    
    // Close modal with escape key
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const openModal = document.querySelector('.modal.show');
            if (openModal) {
                closeModal(openModal.id);
            }
        }
    });
}

// Open modal function
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('show');
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
        
        // Focus trap
        const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        if (firstElement) {
            firstElement.focus();
        }
        
        modal.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstElement) {
                        lastElement.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastElement) {
                        firstElement.focus();
                        e.preventDefault();
                    }
                }
            }
        });
    }
}

// Close modal function
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('show');
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}

// Scroll reveal animation
function initializeScrollReveal() {
    const revealElements = document.querySelectorAll('.reveal, .section-title, .section-subtitle');
    
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    });

    revealElements.forEach(element => {
        element.classList.add('reveal');
        revealObserver.observe(element);
    });
}

// Lazy loading for images
function initializeLazyLoading() {
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.src;
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        });

        images.forEach(img => {
            imageObserver.observe(img);
        });
    }
}

// Notification system
function showNotification(message, type = 'info') {
    // Remove existing notifications
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(notification => {
        notification.remove();
    });

    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <i class="fas ${getNotificationIcon(type)}"></i>
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    // Add styles
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 400px;
        padding: 16px;
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        background: ${getNotificationColor(type)};
        color: white;
        font-family: var(--font-family);
        transform: translateX(100%);
        transition: transform 0.3s ease-out;
    `;

    const content = notification.querySelector('.notification-content');
    content.style.cssText = `
        display: flex;
        align-items: center;
        gap: 12px;
    `;

    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.style.cssText = `
        background: none;
        border: none;
        color: white;
        cursor: pointer;
        padding: 4px;
        margin-left: auto;
        opacity: 0.8;
        transition: opacity 0.2s;
    `;

    closeBtn.addEventListener('mouseenter', () => {
        closeBtn.style.opacity = '1';
    });

    closeBtn.addEventListener('mouseleave', () => {
        closeBtn.style.opacity = '0.8';
    });

    // Add to DOM
    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (notification.parentElement) {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 300);
        }
    }, 5000);
}

function getNotificationIcon(type) {
    switch (type) {
        case 'success': return 'fa-check-circle';
        case 'error': return 'fa-exclamation-circle';
        case 'warning': return 'fa-exclamation-triangle';
        default: return 'fa-info-circle';
    }
}

function getNotificationColor(type) {
    switch (type) {
        case 'success': return '#75a824';
        case 'error': return '#EF4444';
        case 'warning': return '#F59E0B';
        default: return '#005B96';
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Share functionality
function shareContent(url, title, text) {
    if (navigator.share) {
        navigator.share({
            title: title || 'Residenz Bad Kötzting - BayernCare Investment',
            text: text || 'Attraktive Seniorenimmobilien Investment Möglichkeit',
            url: url || window.location.href,
        }).catch(console.error);
    } else {
        // Fallback for browsers that don't support Web Share API
        const shareUrl = `mailto:?subject=${encodeURIComponent(title || 'Residenz Bad Kötzting')}&body=${encodeURIComponent((text || 'Schauen Sie sich diese Investmentmöglichkeit an:') + ' ' + (url || window.location.href))}`;
        window.location.href = shareUrl;
    }
}

// Print functionality
function printPage() {
    window.print();
}

// Copy to clipboard
function copyToClipboard(text) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Link wurde in die Zwischenablage kopiert!', 'success');
        }).catch(() => {
            showNotification('Fehler beim Kopieren des Links.', 'error');
        });
    } else {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('Link wurde in die Zwischenablage kopiert!', 'success');
        } catch (err) {
            showNotification('Fehler beim Kopieren des Links.', 'error');
        }
        document.body.removeChild(textArea);
    }
}

// Performance optimization
function optimizeImages() {
    const images = document.querySelectorAll('img');
    
    images.forEach(img => {
        // Add loading placeholder
        if (!img.complete) {
            img.style.backgroundColor = '#f0f0f0';
        }
        
        img.addEventListener('load', function() {
            this.style.backgroundColor = '';
            this.classList.add('loaded');
        });
        
        img.addEventListener('error', function() {
            this.style.backgroundColor = '#f0f0f0';
            this.alt = 'Bild konnte nicht geladen werden';
        });
    });
}

// Initialize performance optimizations
document.addEventListener('DOMContentLoaded', function() {
    optimizeImages();
});

// Error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript Error:', e.error);
    // In production, you might want to send this to a logging service
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled Promise Rejection:', e.reason);
    // In production, you might want to send this to a logging service
});

// Expose global functions for onclick handlers
window.openModal = openModal;
window.closeModal = closeModal;
window.shareContent = shareContent;
window.printPage = printPage;
window.copyToClipboard = copyToClipboard;


function acceptCookies () {
    const noscript = document.createElement('noscript');
    noscript.innerHTML = `<iframe
        src="https://www.googletagmanager.com/ns.html?id=GTM-NFTRGWRR"
        height="0"
        width="0"
        style="display: none; visibility: hidden">
    </iframe>`;
    
    // Insert as first child of body
    document.body.insertBefore(noscript, document.body.firstChild);
    //run the script 
    (function (w, d, s, l, i) {
        w[l] = w[l] || [];
        w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
        var f = d.getElementsByTagName(s)[0],
          j = d.createElement(s),
          dl = l != "dataLayer" ? "&l=" + l : "";
        j.async = true;
        j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
        f.parentNode.insertBefore(j, f);
      })(window, document, "script", "dataLayer", "GTM-NFTRGWRR");

          const cookieBanner = document.getElementById('cookieBanner');
    if (cookieBanner) {
        cookieBanner.classList.remove('show');
    }
}

function rejectCookies(){
    const cookieBanner = document.getElementById('cookieBanner');
    if (cookieBanner) {
        cookieBanner.classList.remove('show');
    }
}

// Hero slideshow: fades through a list of background images
function initializeHeroSlideshow() {
    const hero = document.getElementById('hero');
    if (!hero) return;

    // Images to show in the slideshow (order matters)
    const images = [
        'images/Fassadenansicht_low_res.jpg',
        'images/Hagelberger_DG_Wohnbereich_quer_low_res.jpg',
        'images/Hagelberger_EG_quer.jpg',
        'images/Dachgeschoss.jpg',
        'images/Hofseite_low_res.jpg'
    ];

    // Find or create container for slides
    let slidesContainer = hero.querySelector('.hero-slides');
    if (!slidesContainer) {
        slidesContainer = document.createElement('div');
        slidesContainer.className = 'absolute inset-0 hero-slides';
        slidesContainer.style.position = 'absolute';
        slidesContainer.style.inset = '0';
        slidesContainer.style.overflow = 'hidden';
        hero.insertBefore(slidesContainer, hero.firstChild);
    }

    // Clear any existing children (defensive)
    // We'll append one <img> element per source and simply fade their opacity.
    slidesContainer.innerHTML = '';

    const imgElements = [];

    // Preload and create DOM <img> elements once so browser won't re-request on each transition
    images.forEach((src, idx) => {
        const img = document.createElement('img');
        img.src = src; // preload and cache
        img.alt = `Slideshow image ${idx + 1}`;
        img.style.position = 'absolute';
        img.style.inset = '0';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.transition = 'opacity 1s ease-in-out';
        img.style.opacity = '0';
        img.style.willChange = 'opacity, transform';
        img.style.zIndex = '0';
        img.decoding = 'async';
        slidesContainer.appendChild(img);
        imgElements.push(img);
    });

    if (imgElements.length === 0) return;

    // Show the first image
    let current = 0;
    imgElements[current].style.opacity = '1';

    const duration = 4000; // ms between transitions

    setInterval(() => {
        const next = (current + 1) % imgElements.length;
        // fade in next, fade out current
        imgElements[next].style.opacity = '1';
        imgElements[current].style.opacity = '0';
        current = next;
    }, duration);
}

// Lightbox: open assets (images & PDFs) in an overlay instead of navigating away
function initializeLightbox() {
    // Create overlay elements once
    let overlay = document.getElementById('global-lightbox-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'global-lightbox-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.position = 'fixed';
        overlay.style.inset = '0';
        overlay.style.background = 'rgba(0,0,0,0.85)';
        overlay.style.display = 'none';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.zIndex = '10050';
        overlay.style.padding = '20px';
        overlay.style.boxSizing = 'border-box';

        const container = document.createElement('div');
        container.id = 'global-lightbox-container';
        container.style.maxWidth = '1100px';
        container.style.width = '100%';
        container.style.maxHeight = '90%';
        container.style.overflow = 'auto';
        container.style.position = 'relative';
        overlay.appendChild(container);

        const closeBtn = document.createElement('button');
        closeBtn.id = 'global-lightbox-close';
        closeBtn.innerHTML = '✕';
        closeBtn.setAttribute('aria-label', 'Schließen');
        closeBtn.style.position = 'absolute';
        closeBtn.style.top = '8px';
        closeBtn.style.right = '8px';
        closeBtn.style.background = 'rgba(255,255,255,0.08)';
        closeBtn.style.color = 'white';
        closeBtn.style.border = 'none';
        closeBtn.style.width = '40px';
        closeBtn.style.height = '40px';
        closeBtn.style.borderRadius = '6px';
        closeBtn.style.cursor = 'pointer';
        closeBtn.style.fontSize = '20px';
        closeBtn.style.lineHeight = '1';
        container.appendChild(closeBtn);

        // Caption area
        const caption = document.createElement('div');
        caption.id = 'global-lightbox-caption';
        caption.style.color = '#ddd';
        caption.style.fontSize = '14px';
        caption.style.marginTop = '8px';
        caption.style.textAlign = 'center';
        overlay.appendChild(caption);

        // Close on click outside container
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeLightbox();
            }
        });

        closeBtn.addEventListener('click', closeLightbox);

        document.body.appendChild(overlay);
    }

    // Helper to open and close
    function openLightbox(href, title) {
        const container = document.getElementById('global-lightbox-container');
        const caption = document.getElementById('global-lightbox-caption');
        // Clear container children except close button
        Array.from(container.children).forEach(child => {
            if (child.id !== 'global-lightbox-close') child.remove();
        });

        const lowerHref = href.toLowerCase();
        if (lowerHref.endsWith('.pdf')) {
            const iframe = document.createElement('iframe');
            iframe.src = href;
            iframe.style.width = '100%';
            iframe.style.height = '80vh';
            iframe.style.border = 'none';
            container.appendChild(iframe);
        } else {
            const img = document.createElement('img');
            img.src = href;
            img.alt = title || '';
            img.style.maxWidth = '100%';
            img.style.maxHeight = '80vh';
            img.style.display = 'block';
            img.style.margin = '0 auto';
            container.appendChild(img);
        }

        caption.textContent = title || href.split('/').pop();

        overlay.style.display = 'flex';
        // trap focus
        overlay.tabIndex = -1;
        overlay.focus();

        // prevent background scrolling
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        const overlay = document.getElementById('global-lightbox-overlay');
        if (!overlay) return;
        overlay.style.display = 'none';
        document.body.style.overflow = '';
        const caption = document.getElementById('global-lightbox-caption');
        if (caption) caption.textContent = '';
    }

    // Close on Esc
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeLightbox();
    });

    // Attach handlers to links with the class 'lightbox-link'
    document.querySelectorAll('a.lightbox-link').forEach(a => {
        // ensure link opens in lightbox
        a.addEventListener('click', (e) => {
            e.preventDefault();
            const href = a.getAttribute('href');
            const title = a.getAttribute('aria-label') || a.getAttribute('title') || '';
            if (!href) return;
            openLightbox(href, title);
        });
    });
}

// Initialize OpenStreetMap (Leaflet) map for the location section
function initializeLocationMap() {
    const address = 'Bürgerstr. 78, 12347 Berlin';
    const mapEl = document.getElementById('map');
    if (!mapEl) return;

    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(address) + '&accept-language=de';

    fetch(url, { headers: { 'Accept': 'application/json' } })
        .then(res => res.json())
        .then(data => {
            if (!data || data.length === 0) {
                mapEl.innerHTML = '<p class="p-4 text-sm text-gray-600">Karte konnte nicht geladen werden. <a href="https://www.openstreetmap.org/search?query=' + encodeURIComponent(address) + '" target="_blank" rel="noopener">OpenStreetMap öffnen</a></p>';
                return;
            }

            const lat = parseFloat(data[0].lat);
            const lon = parseFloat(data[0].lon);

           
                    try {
                        const map = L.map('map', { scrollWheelZoom: false }).setView([lat, lon], 16);

                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            maxZoom: 19,
                            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        }).addTo(map);

                        const marker = L.marker([lat, lon]).addTo(map);
                        marker.bindPopup('<strong>Bürgerstr. 78</strong><br>12347 Berlin').openPopup();
                        console.log('Leaflet map initialized at', lat, lon);
                    } catch (e) {
                        console.error('Leaflet map initialization error:', e);
                        mapEl.innerHTML = '<p class="p-4 text-sm text-gray-600">Karte konnte nicht geladen werden. Bitte öffnen Sie <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener">OpenStreetMap</a>.</p>';
                    }
             
        })
        .catch((e) => {
            console.error('open street map api error:', e);
            mapEl.innerHTML = '<p class="p-4 text-sm text-gray-600">Karte konnte nicht geladen werden. Bitte öffnen Sie <a href="https://www.openstreetmap.org/" target="_blank" rel="noopener">OpenStreetMap</a>.</p>';
        });
}

