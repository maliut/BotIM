// 跑团机器人核心逻辑

// 模块列表
const $modules = {};

// 当前 chatbot
const $chatbot = {}; 

// tim 相关回调
const $tim = TIM.create({ SDKAppID: SDKAPPID });
$tim.setLogLevel(1);
$tim.on(TIM.EVENT.SDK_NOT_READY, () => console.log("sdk not ready"));
$tim.on(TIM.EVENT.ERROR, e => console.log(e.data));
$tim.on(TIM.EVENT.KICKED_OUT, e => {
    console.log("sdk kick reason " + e.data.type);
    $chatbot.name = undefined;
    $('#chatbot-logout').attr('disabled', 'disabled');
    $('#chatbot-login').removeAttr('disabled');
    $('#chatbot-login-prompt').text('被踢下线，可能因为别人登录了，或是点登录手速太快点了两次，请重新登录');
});
$tim.on(TIM.EVENT.SDK_READY, () => console.log("sdk ready"));
$tim.on(TIM.EVENT.MESSAGE_RECEIVED, function(event) {
    let msgList = event.data;
    for (let i = 0; i < msgList.length; i++) {
        handleMessage(msgList[i]);
    }
});
 
// 登录
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
    $tim.login({ userID: name, userSig: genTestUserSig(name).userSig})
        .then(() => {
            $chatbot.name = name;
            $('#chatbot-login-prompt').text('登录成功：' + name);
            $('#chatbot-login').attr('disabled', 'disabled');
            $('#chatbot-logout').removeAttr('disabled');
        }).catch(e => {
            $('#chatbot-login-prompt').text('登录失败：' + e);
        });
});

// 登出
$('#chatbot-logout').click(() => {
    if (!isLogined()) return;
    $tim.logout().then(() => {
        $('#chatbot-login-prompt').text('登出成功：' + $chatbot.name);
        $chatbot.name = undefined;
        $('#chatbot-logout').attr('disabled', 'disabled');
        $('#chatbot-login').removeAttr('disabled');
    })
});

// 是否登录
function isLogined() {
    return $chatbot.name;
}

// 是否是命令消息
function isCommandMsg(msg) {
    return msg.type === TIM.TYPES.MSG_TEXT && msg.payload.text.trim().startsWith('.');
}

// 接收消息
function handleMessage(msg) {
    // 如果是c2c消息，则返回在线状态
    if (msg.conversationType === TIM.TYPES.CONV_C2C) {
        let echoMsg = $tim.createTextMessage({
            to: msg.from,
            conversationType: TIM.TYPES.CONV_C2C,
            payload: {
              text: $chatbot.name + "当前在线！"
            }
        });
        $tim.sendMessage(echoMsg);
    } else if (msg.conversationType === TIM.TYPES.CONV_GROUP) {
        $modules.record.recordMsgIfNeed(msg);   // 处理录制
        if (isCommandMsg(msg)) {
            handleGroupMessage(msg);
        }
    
    }
}

// 处理群指令
function handleGroupMessage(msg) {
    let string = msg.payload.text.trim();
    // 处理指令
    if (string === '.jrrp') {
        // 今日运势
        sendGroupMessage(msg.to, msg.nick + " 今日运势：" + _dice(100) + "%");
        return;
    } else {
        // 默认都走 eval
        $modules.dice.eval(msg);
    }
}

function sendGroupMessage(gid, string) {
    let msg = $tim.createTextMessage({
        to: gid,
        conversationType: TIM.TYPES.CONV_GROUP,
        payload: {
            text: string
        }
    });
    msg.nick = $chatbot.name;
    $modules.record.recordMsgIfNeed(msg);   // 处理录制
    $tim.sendMessage(msg);   // 真正发送消息
}



function _dice(n) {
    return Math.floor(Math.random() * n + 1);
}
// 跑团记录相关逻辑
$modules.record = {};
(function () {

    // 记录一条消息核心逻辑
    const historyContainer = $('#chatbot-chat-history');
    let lastSpeakerNickname = '';   // 上一个说话的人，用于合并会话

    $modules.record.recordMsgIfNeed = (msg) => {
        if (msg.to !== $chatbot.group) return;  // 不是要录制的群，不处理
        if (msg.type !== TIM.TYPES.MSG_TEXT) return;    // 不是文本消息，不处理
        let nickname = msg.nick || msg.from;    // 取发送方昵称
        if (nickname !== lastSpeakerNickname) {
            // 如果不是上一个发言的人，那么要插入昵称
            historyContainer.append(`
<div class='chat-item chat-user-${nickname}'>
    <span class='meta'>${nickname}</span>
    <br />
    <span class='content'>${msg.payload.text.trim()}</span>
</div>`);
            lastSpeakerNickname = nickname;
        } else {
            let size = historyContainer.children().length;
            let lastChild = historyContainer.children()[size - 1];
            $(lastChild).append(`
<br />
<span class='content'>${msg.payload.text.trim()}</span>`);
        }
    }

    // 开始记录
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

    // 停止记录
    $('#chatbot-record-stop').click(() => {
        if (!$chatbot.group) return;
        $('#chatbot-record-prompt').text('停止录制，群：' + $chatbot.group);
        $chatbot.group = undefined;
        $('#chatbot-record-stop').attr('disabled', 'disabled');
        $('#chatbot-record').removeAttr('disabled');
    });

    // 设置 css
    $('#chatbot-css-apply').click(() => {
        $('#chatbot-css').text($('#chatbot-css-input').val());
    });

    // 复制为文本
    new ClipboardJS('#chatbot-copy-text', {
        text: () => {
            alert('复制成功！');
            return $('#chatbot-chat-history').text().trim();
        }
    });

    // 复制为 html
    new ClipboardJS('#chatbot-copy-html', {
        text: () => {
            alert('复制成功！');
            return $('#chatbot-chat-history').html().trim() + '<style>' + $('#chatbot-css').text() + '</style>';
        }
    });
})();
$modules.dice = {};
(function() {

    /*
     * 运算符及其优先级
     * define: 
     *     xdy = x.times { sum += dice(y) }
     *     dy = 1dy
     *     unary [+,-] < [+,-] < [*,/] < unary d < d < [(,)]
     */
    const OPS = {
        'u+': 1,
        'u-': 1,
        '+': 2,
        '-': 2,
        '*': 3,
        '/': 3,
        'ud': 4,
        'd': 5,
        '(': 10,
        ')': 10,
    }

    $modules.dice.eval = (msg) => {
        // 原始表达式，去掉开头点号，形如 d6+d4+1 xxx
        let raw = msg.payload.text.trim().substr(1);
        // 去掉后面的描述
        let exp = raw.split(/\s+/)[0].toLowerCase();
        // 简单过滤非法字符
        if (!exp.match(/^[0-9+\-*/d()]+$/)) return;
        try {
            // 分割为数字和运算符数组，其实可以和下一步合起来只用一次遍历，但清晰起见先区别开
            const arr = split(exp);
            // 转后序表达式，记得区分出一元加减法和 d。如果前面非右括、数字就认为是一元的
            const postfix = toPostfix(arr);
            // 计算之
            const dices = [];
            let result = calculate(postfix, dices);
            if (result === NaN) throw new Error('NaN!');
            console.log("result:" + result + "|" + dices);
            // 拼接回复语
            if (dices.length > 1) {
                raw += " = [" + dices + "]";
            }
            sendGroupMessage(msg.to, (msg.nick || msg.from) + " 投骰 " + raw + ' = ' + result);
        } catch (e) {
            console.log("eval fail " + e);
        }
    }

    // "5+66*8d5" => [5, "+", 66, "*", 8, "d", 5]
    function split(exp) {
        const result = [];
        let tmpnum = "";     // 临时保存下解一半的数字
        for (let i = 0; i < exp.length; i++) {
            let ascii = exp.charCodeAt(i);
            if (ascii >= 48 && ascii <= 57) {
                // 是数字
                tmpnum += exp[i];
            } else {
                // 是运算符
                // 如果前面有数字，就把数字放栈里
                if (tmpnum !== "") {
                    result.push(Number(tmpnum));
                    tmpnum = "";
                }
                // 把运算符放栈里
                result.push(exp[i]);
            }
        }
        // 遍历完，把最后一个数字放进去
        if (tmpnum !== "") {
            result.push(Number(tmpnum));
            tmpnum = "";
        }
        return result;
    }

    // 转后序表达式
    function toPostfix(arr) {
        const ops = [];
        const nums = [];
        for (let i = 0; i < arr.length; i++) {
            let x = arr[i];
            if (typeof x === 'number') {
                // 数字直接入栈
                nums.push(x);
            } else if (x === '(') {
                // 左括号入运算符栈
                ops.push(x);
            } else if (x === ')') {
                // 右括号，pop 中间的运算符入最终栈
                let peek = ops.pop();
                while (peek && peek !== '(') {
                    nums.push(peek);
                    peek = ops.pop();
                }
            } else if (OPS[x]) {
                // 其他运算符，首先判断一下是否是一元运算符
                if (x === '+' || x === '-' || x === 'd') {
                    let prev = arr[i - 1];
                    if (!(prev === ')' || (typeof prev === 'number'))) {
                        x = 'u' + x;
                    }
                }
                // 如果运算符优先级较高，则入运算符栈
                let lastOp = ops[ops.length - 1];
                if (ops.length === 0 || lastOp === '(' || OPS[x] > OPS[lastOp]) {
                    ops.push(x);
                } else {    // 否则把优先级低的都出栈了，自己再入栈
                    do {
                        nums.push(ops.pop());
                        lastOp = ops[ops.length - 1];
                    } while (lastOp && lastOp !== '(' && OPS[x] <= OPS[lastOp]);
                    ops.push(x);
                }
            }
        }
        // ops 还剩下的元素入最终栈
        while (ops.length > 0) {
            nums.push(ops.pop());
        }

        return nums;
    }

    // 从后序表达式计算结果。arr 记录每次 dice 的值
    function calculate(exp, arr) {
        const stack = [];
        exp.forEach(x => {
            if (typeof x === 'number') {
                stack.push(x);
            } else {
                let n1 = stack.pop();   // 取栈顶数字
                if (x === 'u+') {
                    stack.push(n1);
                } else if (x === 'u-') {
                    stack.push(-n1);
                } else if (x === 'ud') {
                    stack.push(dice(n1, arr));
                } else {    // 剩下的都是二元操作符
                    let n2 = stack.pop();
                    if (x === '+') {
                        stack.push(n2 + n1);
                    } else if (x === '-') {
                        stack.push(n2 - n1);
                    } else if (x === '*') {
                        stack.push(n2 * n1);
                    } else if (x === '/') {
                        stack.push(n2 / n1);
                    } else if (x === 'd') {
                        let sum = 0;
                        for (let i = 0; i < n2; i++) {
                            sum += dice(n1, arr);
                        }
                        stack.push(sum);
                    } else {
                        throw new Error("invalid op!");
                    }
                }
            }
        });
        if (stack.length !== 1) {
            throw new Error("invalid exp!");
        }
        return stack.pop();
    }

    // 记录 dice 值到 arr 中
    function dice(n, arr) {
        let ret = _dice(n);
        arr.push(ret);
        return ret;
    }

    function _dice(n) {
        return Math.floor(Math.random() * n + 1);
    }
})();