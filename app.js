document.addEventListener('DOMContentLoaded', () => {
    const gameSetup = document.getElementById('game-setup');
    const gameBoard = document.getElementById('game-board');
    const playerCountInput = document.getElementById('player-count');
    const roleSelectionContainer = document.getElementById('role-selection');
    const startGameButton = document.getElementById('start-game');
    const playerList = document.getElementById('player-list');
    const gamePhaseTitle = document.getElementById('game-phase-title');
    const logList = document.getElementById('log-list');
    const resetGameButton = document.getElementById('reset-game');

    const availableRoles = ['警长', '平民', '预言家', '女巫', '猎人', '白痴', '狼人'];

    // 动态生成角色选择
    function renderRoleSelection() {
        roleSelectionContainer.innerHTML = '';
        availableRoles.forEach(role => {
            const roleDiv = document.createElement('div');
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `role-${role}`;
            checkbox.value = role;
            checkbox.checked = true; // 默认全选

            const label = document.createElement('label');
            label.htmlFor = `role-${role}`;
            label.textContent = role;

            roleDiv.appendChild(checkbox);
            roleDiv.appendChild(label);
            roleSelectionContainer.appendChild(roleDiv);
        });
    }

    // 开始游戏
    startGameButton.addEventListener('click', () => {
        const playerCount = parseInt(playerCountInput.value);
        const selectedRoles = Array.from(roleSelectionContainer.querySelectorAll('input:checked')).map(input => input.value);

        // 简单的验证
        if (selectedRoles.length === 0) {
            alert('请至少选择一个角色！');
            return;
        }

        // TODO: 更复杂的角色数量验证

        initializeGame(playerCount, selectedRoles);
    });

    const actionControls = document.getElementById('action-controls');

    let gameState = {};
    let selectedPlayerId = null;

    // 初始化游戏
    function initializeGame(playerCount, selectedRoles) {
        gameSetup.classList.add('hidden');
        gameBoard.classList.remove('hidden');

        gameState = assignRoles(playerCount, selectedRoles);
        renderPlayers(gameState.players);
        log('游戏开始！角色已秘密分配。');
        runGameLoop();
    }

    // 游戏主循环
    function runGameLoop() {
        const { phase, day } = gameState;
        if (phase === 'night') {
            gamePhaseTitle.textContent = `第 ${day} 天 - 黑夜`;
            handleNightPhase();
        } else if (phase === 'day') {
            gamePhaseTitle.textContent = `第 ${day} 天 - 白天`;
            handleDayPhase();
        }
    }

    // 处理白天阶段
    function handleDayPhase() {
        log('进入白天阶段，请玩家发言并准备投票。');
        // 在第一天处理警长竞选
        if (gameState.day === 1 && !gameState.players.some(p => p.isSheriff)) {
            log('请进行警长竞选。');
            // TODO: 实现警长竞选逻辑
        }

        setupPlayerSelection(player => player.isAlive && !player.isRevealedIdiot, (selectedId) => {
            handleVote(selectedId);
        }, '投票淘汰该玩家');
    }

    // 处理投票结果
    function handleVote(votedId) {
        const player = gameState.players.find(p => p.id === votedId);
        if (player) {
            log(`${player.id} 号玩家被投票出局，身份是 ${player.role}。`);

            if (player.role === '白痴') {
                player.isRevealedIdiot = true;
                log('白痴翻牌，保留在场上但失去投票权。');
                renderPlayers(gameState.players);
                if (checkForWinner()) return;
                startNextNight();
                return;
            }

            player.isAlive = false;
            renderPlayers(gameState.players);

            if (player.role === '猎人') {
                handleHunterSkill(() => {
                    if (checkForWinner()) return;
                    startNextNight();
                });
            } else {
                if (checkForWinner()) return;
                startNextNight();
            }
        }
    }

    function startNextNight() {
        gameState.day++;
        gameState.phase = 'night';
        runGameLoop();
    }

    // 处理夜晚阶段
    function handleNightPhase() {
        gameState.victim = null; // 每个夜晚开始时重置
        gameState.poisonedTarget = null; // 每个夜晚开始时重置

        // 顺序：狼人 -> 预言家 -> 女巫
        const wolves = gameState.players.filter(p => p.role === '狼人' && p.isAlive);
        const prophet = gameState.players.find(p => p.role === '预言家' && p.isAlive);
        const witch = gameState.players.find(p => p.role === '女巫' && p.isAlive);

        // 简单的队列来处理行动顺序
        const nightActions = [];
        if (wolves.length > 0) nightActions.push(handleWolvesAction);
        if (prophet) nightActions.push(handleProphetAction);
        if (witch) nightActions.push(handleWitchAction);

        // 添加一个结束夜晚的动作
        nightActions.push((callback) => {
            log('黑夜结束，天亮了。');
            let deathAnnouncements = [];
            let hunterDied = false;

            if (gameState.victim) {
                const victimPlayer = gameState.players.find(p => p.id === gameState.victim);
                if (victimPlayer) {
                    victimPlayer.isAlive = false;
                    deathAnnouncements.push(`${victimPlayer.id} 号玩家昨晚被淘汰了`);
                    if (victimPlayer.role === '猎人') hunterDied = true;
                }
            }

            if (gameState.poisonedTarget) {
                const poisonedPlayer = gameState.players.find(p => p.id === gameState.poisonedTarget);
                if (poisonedPlayer) {
                    poisonedPlayer.isAlive = false;
                    deathAnnouncements.push(`${poisonedPlayer.id} 号玩家昨晚被淘汰了`);
                    if (poisonedPlayer.role === '猎人') hunterDied = true;
                }
            }

            if (deathAnnouncements.length === 0) {
                log('昨晚是平安夜。');
            } else {
                log(deathAnnouncements.join('，') + '。');
            }

            renderPlayers(gameState.players);
            if (checkForWinner()) return;

            if (hunterDied) {
                handleHunterSkill(() => {
                    if (checkForWinner()) return;
                    gameState.phase = 'day';
                    runGameLoop();
                    callback();
                });
            } else {
                gameState.phase = 'day';
                runGameLoop();
                callback();
            }
        });

        // 执行行动队列
        let currentActionIndex = 0;
        function nextAction() {
            if (currentActionIndex < nightActions.length) {
                nightActions[currentActionIndex++](nextAction);
            }
        }
        nextAction();
    }

    function handleWolvesAction(callback) {
        log('狼人请睁眼，请选择要淘汰的玩家。');
        setupPlayerSelection(player => player.isAlive, (selectedId) => {
            gameState.victim = selectedId;
            log(`狼人选择了 ${selectedId} 号玩家。`);
            callback();
        });
    }

    function handleProphetAction(callback) {
        log('预言家请睁眼，请选择要查验的玩家。');
        setupPlayerSelection(player => player.isAlive, (selectedId) => {
            const targetPlayer = gameState.players.find(p => p.id === selectedId);
            const isWolf = targetPlayer.role === '狼人';
            alert(`查验结果：${selectedId} 号玩家是 ${isWolf ? '狼人' : '好人'}。`);
            log(`预言家查验了 ${selectedId} 号玩家。`);
            callback();
        });
    }

    function handleWitchAction(callback) {
        log('女巫请睁眼。');
        clearActionControls();

        const doSave = () => {
            if (gameState.victim && !gameState.witchUsedSave) {
                log(`昨晚 ${gameState.victim} 号玩家倒牌了，是否使用解药？`);
                const saveButton = document.createElement('button');
                saveButton.textContent = '使用解药';
                saveButton.onclick = () => {
                    log(`女巫使用了灵药，救了 ${gameState.victim} 号玩家。`);
                    gameState.victim = null; // 救人成功
                    gameState.witchUsedSave = true;
                    doPoison(); // 进入毒人环节
                };

                const skipSaveButton = document.createElement('button');
                skipSaveButton.textContent = '跳过';
                skipSaveButton.onclick = () => doPoison(); // 进入毒人环节

                actionControls.appendChild(saveButton);
                actionControls.appendChild(skipSaveButton);
            } else {
                doPoison();
            }
        };

        const doPoison = () => {
            clearActionControls();
            if (!gameState.witchUsedPoison) {
                log('是否使用毒药？');
                const poisonButton = document.createElement('button');
                poisonButton.textContent = '使用毒药';
                poisonButton.onclick = () => {
                    setupPlayerSelection(p => p.isAlive, (poisonedId) => {
                        gameState.poisonedTarget = poisonedId;
                        gameState.witchUsedPoison = true;
                        log(`女巫使用了毒药，选择了 ${poisonedId} 号玩家。`);
                        callback(); // 完成女巫回合
                    }, '选择下毒目标');
                };

                const skipPoisonButton = document.createElement('button');
                skipPoisonButton.textContent = '跳过';
                skipPoisonButton.onclick = () => callback(); // 完成女巫回合

                actionControls.appendChild(poisonButton);
                actionControls.appendChild(skipPoisonButton);
            } else {
                callback(); // 药都用完了，直接结束
            }
        };

        doSave(); // 开始女巫的逻辑流程
    }

    function handleHunterSkill(callback) {
        log('猎人被淘汰，请选择一名玩家开枪带走。');
        setupPlayerSelection(p => p.isAlive, (shotId) => {
            const shotPlayer = gameState.players.find(p => p.id === shotId);
            if (shotPlayer) {
                shotPlayer.isAlive = false;
                log(`猎人开枪带走了 ${shotPlayer.id} 号玩家。`);
                renderPlayers(gameState.players);
            }
            callback();
        }, '确认开枪');
    }

    // 设置玩家选择
    function setupPlayerSelection(filterFunc, onConfirm, buttonText = '确认选择') {
        clearActionControls();
        selectedPlayerId = null;

        document.querySelectorAll('.player-card').forEach(card => {
            const playerId = parseInt(card.dataset.playerId);
            const player = gameState.players.find(p => p.id === playerId);

            if (filterFunc(player)) {
                card.classList.add('selectable');
                card.onclick = () => selectPlayer(playerId);
            } else {
                card.classList.remove('selectable');
                card.onclick = null;
            }
        });

        const confirmButton = document.createElement('button');
        confirmButton.textContent = buttonText;
        confirmButton.onclick = () => {
            if (selectedPlayerId) {
                onConfirm(selectedPlayerId);
                clearPlayerSelection();
                clearActionControls();
            } else {
                alert('请选择一个玩家。');
            }
        };
        actionControls.appendChild(confirmButton);
    }

    function selectPlayer(playerId) {
        selectedPlayerId = playerId;
        document.querySelectorAll('.player-card').forEach(card => {
            card.classList.remove('selected');
            if (parseInt(card.dataset.playerId) === playerId) {
                card.classList.add('selected');
            }
        });
    }

    function clearPlayerSelection() {
        selectedPlayerId = null;
        document.querySelectorAll('.player-card').forEach(card => {
            card.classList.remove('selectable', 'selected');
            card.onclick = null;
        });
    }

    function clearActionControls() {
        actionControls.innerHTML = '';
    }

    function checkForWinner() {
        const alivePlayers = gameState.players.filter(p => p.isAlive);
        const aliveWolves = alivePlayers.filter(p => p.role === '狼人');
        // 在判断胜利条件时，翻牌的白痴算作好人阵营的存活玩家
        const aliveGoodPlayers = alivePlayers.filter(p => p.role !== '狼人' || p.isRevealedIdiot);

        let winner = null;
        if (aliveWolves.length === 0) {
            winner = '好人阵营';
        } else if (aliveWolves.length >= aliveGoodPlayers.length) {
            winner = '狼人阵营';
        }

        if (winner) {
            gamePhaseTitle.textContent = `${winner}胜利！`;
            log(`游戏结束，${winner}胜利！`);
            clearActionControls();
            // 禁用所有未来的操作
            gameState.phase = 'gameover';
            return true;
        }
        return false;
    }

    // 分配角色
    function assignRoles(playerCount, selectedRoles) {
        // TODO: 这部分应该更加灵活，基于用户的选择
        const rolesToAssign = ['预言家', '女巫', '猎人', '狼人', '狼人', '平民', '平民', '白痴']; // 示例配置
        
        // 打乱角色数组
        const shuffledRoles = rolesToAssign.sort(() => Math.random() - 0.5);

        const players = [];
        for (let i = 1; i <= playerCount; i++) {
            players.push({
                id: i,
                role: shuffledRoles[i - 1] || '平民', // 如果角色不够，默认为平民
                isAlive: true,
                isSheriff: false,
                isRevealedIdiot: false,
            });
        }

        return {
            players,
            day: 1,
            phase: 'night', // or 'day'
            witchUsedSave: false,
            witchUsedPoison: false,
            victim: null,
            poisonedTarget: null,
        };
    }

    // 渲染玩家列表
    function renderPlayers(players) {
        playerList.innerHTML = '';
        players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.dataset.playerId = player.id;
            if (!player.isAlive) {
                playerCard.classList.add('dead');
            }
            if (player.isRevealedIdiot) {
                playerCard.classList.add('revealed-idiot');
            }

            // 在这里，我们为了方便调试，暂时显示角色。实际游戏中应该隐藏。
            playerCard.innerHTML = `<h3>玩家 ${player.id}</h3><div class="role">${player.role}</div>`;
            
            playerList.appendChild(playerCard);
        });
    }

    // 记录日志
    function log(message) {
        const li = document.createElement('li');
        li.textContent = message;
        logList.appendChild(li);
        logList.scrollTop = logList.scrollHeight; // 自动滚动到底部
    }

    // 重置游戏
    resetGameButton.addEventListener('click', () => {
        gameBoard.classList.add('hidden');
        gameSetup.classList.remove('hidden');
        logList.innerHTML = '';
    });

    // 初始化
    renderRoleSelection();
});
