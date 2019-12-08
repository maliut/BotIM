const tim = TIM.create({ SDKAppID: 1400294749 });
tim.setLogLevel(1);
tim.on(TIM.EVENT.SDK_NOT_READY, () => console.log("sdk not ready"));
tim.on(TIM.EVENT.ERROR, e => console.log(e.data));
tim.on(TIM.EVENT.KICKED_OUT, e => {
    console.log("sdk kick reason " + e.data.type);
    $chatbot.name = undefined;
    $('#chatbot-logout').attr('disabled', 'disabled');
    $('#chatbot-login').removeAttr('disabled');
    $('#chatbot-login-prompt').text('被踢下线，可能因为别人登录了，或是点登录手速太快点了两次，请重新登录');
});
tim.on(TIM.EVENT.SDK_READY, () => console.log("sdk ready"));
tim.on(TIM.EVENT.MESSAGE_RECEIVED, function(event) {
    let msgList = event.data;
    for (let i = 0; i < msgList.length; i++) {
        handleMessage(msgList[i]);
    }
});


let $chatbot = {};  
$('#chatbot-login').click(() => {
    if (isLogined()) {
        $('#chatbot-login-prompt').text('禁止重复登录');
        return;
    }
    let name = $('#chatbot-name').val().trim();
    if (name === '') {
        $('#chatbot-login-prompt').text('请输入骰子姬的名字');
        return;
    }
    tim.login({ userID: name, userSig: genTestUserSig(name).userSig})
        .then(() => {
            $chatbot.name = name;
            $('#chatbot-login-prompt').text('登录成功：' + name);
            $('#chatbot-login').attr('disabled', 'disabled');
            $('#chatbot-logout').removeAttr('disabled');
        }).catch(e => {
            $('#chatbot-login-prompt').text('登录失败：' + e);
        });
});

$('#chatbot-logout').click(() => {
    if (!isLogined()) return;
    tim.logout().then(() => {
        $('#chatbot-login-prompt').text('登出成功：' + $chatbot.name);
        $chatbot.name = undefined;
        $('#chatbot-logout').attr('disabled', 'disabled');
        $('#chatbot-login').removeAttr('disabled');
    })
});

function isLogined() {
    return $chatbot && $chatbot.name;
}

$('#chatbot-record').click(() => {
    let gid = $('#chatbot-group-name').val().trim();
    if (gid === '') {
        $('#chatbot-record-prompt').text('请输入群ID');
        return;
    }
    $chatbot.group = gid;
    $('#chatbot-record-prompt').text('开始录制，群：' + gid);
    $('#chatbot-record').attr('disabled', 'disabled');
    $('#chatbot-record-stop').removeAttr('disabled');
});

$('#chatbot-record-stop').click(() => {
    if (!$chatbot.group) return;
    $('#chatbot-record-prompt').text('停止录制，群：' + $chatbot.group);
    $chatbot.group = undefined;
    $('#chatbot-record-stop').attr('disabled', 'disabled');
    $('#chatbot-record').removeAttr('disabled');
});

$('#chatbot-css-apply').click(() => {
    $('#chatbot-css').text($('#chatbot-css-input').val());
});

new ClipboardJS('#chatbot-copy-text', { text: () => {
    alert('复制成功！');
    return $('#chatbot-chat-history').text().trim();
}});
new ClipboardJS('#chatbot-copy-html', { text: () => {
    alert('复制成功！');
    return $('#chatbot-chat-history').html().trim() + '<style>' + $('#chatbot-css').text() + '</style>';
}});

function handleMessage(msg) {
    // 如果是c2c消息，则返回在线状态
    if (msg.conversationType === TIM.TYPES.CONV_C2C) {
        let echoMsg = tim.createTextMessage({
            to: msg.from,
            conversationType: TIM.TYPES.CONV_C2C,
            payload: {
              text: $chatbot.name + "当前在线！"
            }
        });
        tim.sendMessage(echoMsg);
    } else if (msg.conversationType === TIM.TYPES.CONV_GROUP) {
        if (msg.type !== TIM.TYPES.MSG_TEXT) return;    // 不是文本消息，忽略
        handleGroupMessage(msg);
    }
}

function handleGroupMessage(msg) {
    recordMsgIfNeed(msg);   // 处理录制
    let string = msg.payload.text.trim();
    if (!string.startsWith('.')) return;    // 不是指令，忽略
    // 处理指令
    if (string === '.jrrp') {
        // 今日运势
        sendGroupMessage(msg.to, msg.nick + " 今日运势：" + _dice(100) + "%");
        return;
    } else {
        // 默认都走 eval
        string = string.substr(1);
        let result = getEvalResult(string);
        if (!result) return;
        sendGroupMessage(msg.to, msg.nick + " 投骰 " + string + ' = ' + result);
        return;
    }
    // sendGroupMessage(msg.to, "echo");
}

function sendGroupMessage(gid, string) {
    let msg = tim.createTextMessage({
        to: gid,
        conversationType: TIM.TYPES.CONV_GROUP,
        payload: {
            text: string
        }
    });
    msg.nick = $chatbot.name;
    recordMsgIfNeed(msg);   // 处理录制
    tim.sendMessage(msg);   // 真正发送消息
}

const historyContainer = $('#chatbot-chat-history');
let lastSpeakerNickname = '';   // 上一个说话的人，用于合并会话
function recordMsgIfNeed(msg) {
    if (msg.to !== $chatbot.group) return;  // 不是要录制的群，不处理
    if (msg.nick !== lastSpeakerNickname) {
        // 如果不是上一个发言的人，那么要插入昵称
        historyContainer.append(`
<div class='chat-item chat-user-${msg.nick}'>
    <span class='meta'>${msg.nick}</span>
    <br />
    <span class='content'>${msg.payload.text.trim()}</span>
</div>`);
        lastSpeakerNickname = msg.nick;
    } else {
        let size = historyContainer.children().length;
        let lastChild = historyContainer.children()[size - 1];
        $(lastChild).append(`
<br />
<span class='content'>${msg.payload.text.trim()}</span>`);
    }
}

function _dice(n) {
    return Math.floor(Math.random() * n + 1);
}

// 记录 dice 值到 arr 中
function dice(n, arr) {
    let ret = _dice(n);
    arr.push(ret);
    return ret;
}

function getEvalResult(string) {
    string = string.split(/\s+/)[0];
    // 简单过滤非法字符
    if (!string.match(/^[0-9+-d]/)) return;
    let arr = [];
    // 处理 5d20 这种的
    string = string.replace(/(\d+)d(\d+)/, (_, p1, p2) => {
        let time = parseInt(p1);
        if (time === NaN) return null;  // 理论上不会，保护下
        if (time === 0) return '';  // 0d20 没意义
        let result = `(dice(${p2}, arr)`;
        for (let i = 1; i < time; i++) {
            result += `+dice(${p2}, arr)`;
        }
        result += ')';
        return result;
    });
    if (string === null) return;
    // 处理 d20 这种的
    string = string.replace(/d(\d+)/, 'dice($1, arr)');
    try {
        let num = eval(string);
        if (!num) return;
        let result = '';
        if (arr.length > 1) {
            result += '(' + arr[0];
            for (let i = 1; i < arr.length; i++) {
                result += '+' + arr[i];
            }
            result += ') = ';
        }
        result += num;
        return result;
    } catch (e) {
        // ignore
    }
}