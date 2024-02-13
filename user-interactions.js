// open/close the right panel
const togglePanel = document.getElementById('toggle-panel');
togglePanel.addEventListener('click', () => {
	if (togglePanel.dataset.status === 'opened') {
		togglePanel.dataset.status = 'closed';

		document.querySelectorAll('section[data-type="panel-reactive"]').forEach((elem) => {
			elem.classList = '';
		});

		document.getElementById('panel-body').style.display = 'none';
	} else {
		togglePanel.dataset.status = 'opened';

		document.querySelectorAll('section[data-type="panel-reactive"]').forEach((elem) => {
			elem.classList = 'panel-opened';
		});

		document.getElementById('panel-body').style.display = 'block';
	}
});

// user interactivity
document.addEventListener('input', (event) => {
	// save the new value in a variable
	const newValue = event.target.value;
	// display the new value
	const targetDOM = event.target.previousElementSibling.querySelector('span[data-type="slider-input"]');
	targetDOM.innerHTML = newValue;
	// update the global variable
	window.interactables[event.target.dataset.varname] = newValue;
});