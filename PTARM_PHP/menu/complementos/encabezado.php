<php
$pageTitle = $pageTitle ? $pageTitle : 'PTARM';
>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><= h($pageTitle) > | PTARM</title>
<link rel="icon" type="image/png" href="<= app_url('img/logot.png') >">
<link rel="stylesheet" href="<= app_url('css/styles.css') >">
<link rel="stylesheet" href="<= app_url('css/estilos.css') >">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css">
<script>
    (() => {
        const root = document.documentElement;
        const dark = localStorage.getItem('theme') === 'dark';
        root.dataset.theme = dark ? 'dark' : 'light';
        root.classList.toggle('theme-dark', dark);
        root.classList.toggle('sidebar-start-collapsed', localStorage.getItem('sidebarCollapsed') === '1');
    })();
</script>
