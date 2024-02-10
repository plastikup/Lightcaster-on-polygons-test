const togglePanel = document.getElementById('toggle-panel');
togglePanel.addEventListener('click', () => {
	if (togglePanel.dataset.status === 'opened') {
		togglePanel.dataset.status = 'closed';

		document.querySelectorAll('section[data-toggleable="panel"]').forEach((elem) => {
			elem.classList = '';
		});

		document.getElementById('panel-body').style.display = 'none';
	} else {
		togglePanel.dataset.status = 'opened';

		document.querySelectorAll('section[data-toggleable="panel"]').forEach((elem) => {
			elem.classList = 'panel-opened';
		});

		document.getElementById('panel-body').style.display = 'block';
	}
});
