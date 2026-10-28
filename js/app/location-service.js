(function (root) {
    'use strict';
    let pending = null;
    const reason = error => ({1:'permission_denied',2:'position_unavailable',3:'timeout'})[Number(error?.code)] || 'position_unavailable';
    function message(error) {
        if (Number(error?.code) === 1) return 'O acesso à localização foi bloqueado. Confira a permissão do site e do navegador.';
        if (Number(error?.code) === 3) return 'O celular demorou para informar a localização. Tente novamente em um local com melhor sinal.';
        return 'O celular não conseguiu informar a localização, mesmo com a permissão ativa. Tente novamente; se persistir, desligue e ligue a localização do aparelho ou reinicie o navegador.';
    }
    function request(highAccuracy) {
        return new Promise((resolve, reject) => {
            const fail = (code, detail) => Object.assign(new Error(message({code})), {code,device_message:String(detail||'').slice(0,500),accuracy_mode:highAccuracy?'high':'standard'});
            if (!root.navigator?.geolocation) { reject(fail(2)); return; }
            let settled = false;
            const timeout = highAccuracy ? 10000 : 8000;
            const finish = (callback, value) => {
                if (settled) return;
                settled = true; clearTimeout(watchdog); callback(value);
            };
            const watchdog = setTimeout(() => finish(reject, fail(3)), timeout + 500);
            try {
                root.navigator.geolocation.getCurrentPosition(position => {
                    const c = position?.coords;
                    if (!c || !Number.isFinite(c.latitude) || !Number.isFinite(c.longitude)
                        || Math.abs(c.latitude)>90 || Math.abs(c.longitude)>180
                        || (Number.isFinite(position.timestamp) && Date.now()-position.timestamp>60000)) {
                        finish(reject, fail(2)); return;
                    }
                    finish(resolve, position);
                }, error => {
                    // Retain technical detail only in the developer console, never in the user message.
                    console.warn('[Location] Device location request failed', { code:error?.code, message:error?.message, highAccuracy });
                    finish(reject, fail([1,2,3].includes(Number(error?.code)) ? Number(error.code) : 2,error?.message));
                }, {enableHighAccuracy:highAccuracy,timeout,maximumAge:0});
            } catch (error) {
                console.warn('[Location] Device location service failed', error);
                finish(reject, fail(2,error?.message));
            }
        });
    }
    function getCurrentPosition() {
        if (pending) return pending;
        pending = (async () => {
            try { return await request(true); }
            catch (error) {
                if (error.code===1) throw error;
                try { return await request(false); }
                catch (second) {
                    second.attempts = [error,second].map(item=>({code:item.code,device_message:item.device_message,accuracy_mode:item.accuracy_mode}));
                    throw second;
                }
            }
        })().finally(() => {pending=null;});
        return pending;
    }
    root.PrimeLocation = {getCurrentPosition,message,reason};
})(window);
