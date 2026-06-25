<php
$topUser = current_user();
$photo = $topUser['imagen_perfil'] : 'img/usuario.png';
>
<header class="topbar barra-superior">
    <a class="topbar-brand" href="<= app_url('cruds/inicio.php') >">
        <img class="logo logo-fge" src="<= app_url('img/Logo.png') >" alt="PTARM">
        <span>Sistema de Partes</span>
    </a>
    <div class="user-menu usuario-superior">
        <button class="user-top boton-perfil" type="button" onclick="document.querySelector('.user-dropdown').classList.toggle('show')">
            <i class="fas fa-bell campana"></i>
            <span><= h($topUser['nombre']  'Usuario') ></span>
            <img src="<= app_url($photo) >" alt="Perfil">
        </button>
        <div class="user-dropdown animated--grow-in">
            <a href="<= app_url('cruds/perfil.php') >"><i class="fas fa-user"></i> Perfil</a>
            <a href="<= app_url('registroUser/logout.php') >"><i class="fas fa-sign-out-alt"></i> Cerrar Sesion</a>
        </div>
    </div>
</header>
