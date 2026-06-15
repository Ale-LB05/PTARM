<php
$activePage = $activePage  '';
>
<aside class="sidebar barra-lateral" id="sidebar">
    <a class="side-brand marca-menu" href="<= app_url('cruds/inicio.php') >">
        <span class="brand-icon"><img src="<= app_url('img/logot.png') >" alt="PTARM"></span>
        <span class="brand-text">PTARM</span>
    </a>
    <nav class="side-nav menu-lateral">
        <a class="<= $activePage === 'inicio'  'activo' : '' >" href="<= app_url('cruds/inicio.php') >">
            <span class="nav-icon"><img src="<= app_url('img/iconos/Inicio.png') >" alt=""></span>
            <span>Inicio</span>
        </a>
        <div class="side-section separador-menu">Administracion</div>
        <php if (user_has_role('Administrador')): >
            <a class="<= $activePage === 'personal'  'activo' : '' >" href="<= app_url('cruds/personal.php') >">
                <span class="nav-icon"><img src="<= app_url('img/iconos/personal.png') >" alt=""></span>
                <span>Personal</span>
            </a>
        <php endif; >
        <a class="<= $activePage === 'partes'  'activo' : '' >" href="<= app_url('registroPartes/partes.php') >">
            <span class="nav-icon"><img src="<= app_url('img/iconos/gestion.png') >" alt=""></span>
            <span>Gestionar partes</span>
        </a>
        <a class="<= $activePage === 'historial'  'activo' : '' >" href="<= app_url('cruds/historial.php') >">
            <span class="nav-icon"><img src="<= app_url('img/iconos/historial.png') >" alt=""></span>
            <span>Historial</span>
        </a>
        <a class="<= $activePage === 'perfil'  'activo' : '' >" href="<= app_url('cruds/perfil.php') >">
            <span class="nav-icon"><i class="fas fa-user"></i></span>
            <span>Perfil</span>
        </a>
        <div class="side-section separador-menu">Sesion</div>
        <a href="<= app_url('registroUser/logout.php') >">
            <span class="nav-icon"><img src="<= app_url('img/iconos/salida.png') >" alt=""></span>
            <span>Cerrar sesion</span>
        </a>
        <button class="collapse-btn boton-contraer" type="button" onclick="toggleSidebar()" title="Contraer menu">
            <i class="fas fa-chevron-left"></i>
        </button>
    </nav>
</aside>
