<div id="confirmModal" class="modal-backdrop">
    <div class="modal small">
        <div class="modal-title">
            <h2>Confirmar accion</h2>
            <button class="modal-close" type="button" onclick="closeConfirm()">X</button>
        </div>
        <div class="modal-body" style="text-align:center">
            <div class="alert-icon">!</div>
            <p id="confirmText">Deseas continuar</p>
            <div class="form-actions">
                <button class="btn" type="button" onclick="closeConfirm()">Cancelar</button>
                <button class="btn red" id="confirmYes" type="button">Aceptar</button>
            </div>
        </div>
    </div>
</div>
