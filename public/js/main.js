(function () {
  var page = document.querySelector('.regional-page');
  if (page) page.classList.add('concept-motion-ready');

  var reveal = document.querySelectorAll('[data-reveal]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-revealed');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.08 });
    reveal.forEach(function (el) { io.observe(el); });
  } else {
    reveal.forEach(function (el) { el.classList.add('is-revealed'); });
  }

  var nav = document.querySelector('.regional-nav-wrap');
  if (nav) {
    var updateNav = function () {
      nav.classList.toggle('is-scrolled', window.scrollY > 8);
    };
    updateNav();
    window.addEventListener('scroll', updateNav, { passive: true });
  }

  var sectionLinks = Array.prototype.slice.call(document.querySelectorAll('[data-section-link]'));
  var sections = sectionLinks.map(function (link) {
    return document.getElementById(link.getAttribute('data-section-link'));
  }).filter(Boolean);

  function setActiveSection(id) {
    var sectionNav = document.querySelector('.section-nav');
    if (sectionNav) sectionNav.classList.toggle('is-light', id === 'contact');
    sectionLinks.forEach(function (link) {
      var active = link.getAttribute('data-section-link') === id;
      if (active) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  if (sections.length) {
    var updateActiveSection = function () {
      var viewportCenter = window.innerHeight / 2;
      var nearest = sections.slice().sort(function (a, b) {
        var aRect = a.getBoundingClientRect();
        var bRect = b.getBoundingClientRect();
        return Math.abs(aRect.top + aRect.height / 2 - viewportCenter) - Math.abs(bRect.top + bRect.height / 2 - viewportCenter);
      })[0];
      if (nearest) setActiveSection(nearest.id);
    };
    updateActiveSection();
    window.addEventListener('scroll', updateActiveSection, { passive: true });
    window.addEventListener('resize', updateActiveSection);
    if ('IntersectionObserver' in window) {
      var sectionObserver = new IntersectionObserver(function (entries) {
        var visible = entries.filter(function (entry) { return entry.isIntersecting; })
          .sort(function (a, b) { return b.intersectionRatio - a.intersectionRatio; });
        if (visible[0]) setActiveSection(visible[0].target.id);
      }, { rootMargin: '-34% 0px -34% 0px', threshold: [0, 0.15, 0.35] });
      sections.forEach(function (section) { sectionObserver.observe(section); });
    }
  }

  var form = document.getElementById('requirement-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var submit = form.querySelector('[type="submit"]');
  var requiredFields = Array.prototype.slice.call(form.querySelectorAll('[required]'));

  function setValidityState(el, isValid) {
    el.classList.toggle('is-invalid', !isValid);
    el.setAttribute('aria-invalid', isValid ? 'false' : 'true');
  }

  function showStatus(message, ok) {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.classList.toggle('is-success', !!ok);
    status.classList.toggle('is-error', !ok);
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
  }

  requiredFields.forEach(function (el) {
    var eventName = el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(eventName, function () {
      setValidityState(el, el.checkValidity());
      if (status && !status.hidden) status.hidden = true;
    });
  });

  form.addEventListener('submit', function (ev) {
    ev.preventDefault();

    var firstInvalid = null;
    requiredFields.forEach(function (el) {
      var valid = el.checkValidity();
      setValidityState(el, valid);
      if (!valid && !firstInvalid) firstInvalid = el;
    });

    if (firstInvalid) {
      firstInvalid.focus();
      showStatus('Please complete the required fields and enter a valid business email.', false);
      return;
    }

    if (!window.fetch || !window.FormData) {
      form.submit();
      return;
    }

    var original = submit ? submit.innerHTML : '';
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'SENDING…';
    }
    if (status) status.hidden = true;

    var formData = new FormData(form);
    var inquiryType = String(formData.get('inquiry-type') || '');
    var organizationTypes = {
      'Source healthcare data': 'Data buyer',
      'Discuss an institutional partnership': 'Healthcare institution',
      'Discuss a commercial partnership': 'Commercial partner',
      'Other': 'Other'
    };

    fetch(form.action, {
      method: 'POST',
      body: JSON.stringify({
        organizationName: String(formData.get('organization') || ''),
        organizationType: organizationTypes[inquiryType] || 'Other',
        contactName: String(formData.get('name') || ''),
        email: String(formData.get('email') || ''),
        interest: inquiryType,
        description: String(formData.get('requirement') || ''),
        referralSource: 'UBC public site',
        consentAccepted: formData.get('consent') !== null
      }),
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json().catch(function () { return { ok: false, message: 'We could not submit your inquiry just now. Please try again later.' }; })
        .then(function (data) { return { status: res.status, data: data }; });
    }).then(function (result) {
      if (result.status >= 200 && result.status < 300 && result.data.id) {
        showStatus('Thank you. Your inquiry has been received. A UBC lead will respond within two business days.', true);
        form.reset();
        requiredFields.forEach(function (el) {
          el.classList.remove('is-invalid');
          el.setAttribute('aria-invalid', 'false');
        });
      } else {
        showStatus(result.data.error || 'We could not submit your inquiry just now. Please try again later.', false);
      }
    }).catch(function () {
      showStatus('We could not submit your inquiry just now. Please try again later.', false);
    }).then(function () {
      if (submit) {
        submit.disabled = false;
        submit.innerHTML = original;
      }
    });
  });
})();
