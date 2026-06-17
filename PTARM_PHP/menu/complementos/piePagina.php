<script>
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('contraida');
    document.querySelector('.app-shell').classList.toggle('sidebar-collapsed');
    localStorage.setItem('sidebarCollapsed', sidebar.classList.contains('contraida') ? '1' : '0');
}

function closeConfirm() {
    document.getElementById('confirmModal').classList.remove('show');
}

function confirmSubmit(form, text) {
    const modal = document.getElementById('confirmModal');
    const yes = document.getElementById('confirmYes');
    const label = document.getElementById('confirmText');
    if (!modal || !yes || !label) {
        form.submit();
        return false;
    }
    label.textContent = text || 'Deseas continuar';
    yes.onclick = () => form.submit();
    modal.classList.add('show');
    return false;
}

document.addEventListener('click', (event) => {
    if (!event.target.closest('.user-menu')) {
        document.querySelector('.user-dropdown').classList.remove('show');
    }
});

if (localStorage.getItem('sidebarCollapsed') === '1') {
    document.getElementById('sidebar').classList.add('contraida');
}
</script>
