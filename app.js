document.addEventListener('DOMContentLoaded', () => {
    const gameSetup = document.getElementById('game-setup');
    const gameBoard = document.getElementById('game-board');
    const playerCountInput = document.getElementById('player-count');
    const roleSelectionContainer = document.getElementById('role-selection');
    const startGameButton = document.getElementById('start-game');
    const playerList = document.getElementById('player-list');
    const gamePhaseTitle = document.getElementById('game-phase-title');
    const currentPrompt = document.getElementById('current-prompt');
    const logList = document.getElementById('log-list');
    const resetGameButton = document.getElementById('reset-game');
    const modal = document.getElementById('modal');
    const modalText = document.getElementById('modal-text');
    const modalClose = document.getElementById('modal-close');

    const sheriffVoteArea = document.getElementById('sheriff-vote-area');
    const sheriffCandidatesList = document.getElementById('sheriff-candidates-list');
    const confirmSheriffVoteButton = document.getElementById('confirm-sheriff-vote');

    const availableRoles = ['平民', '预言家', '女巫', '猎人', '白痴', '狼人'];

    // 显示模态框
    function showModal(text, callback) {
        modalText.textContent = text;
        modal.classList.remove('hidden');
        modalClose.onclick = () => {
            modal.classList.add('hidden');
            if (callback) callback();
        };
    }

    // 动态生成角色选择
    function renderRoleSelection() {
        console.log('renderRoleSelection called');
        roleSelectionContainer.innerHTML = '';
        // 简单的预设，可以根据玩家人数调整
        const playerCount = parseInt(playerCountInput.value) || 12;
        const roles = getPresetRoles(playerCount);

        const roleCounts = roles.reduce((acc, role) => {
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {});

        console.log('Role Counts:', roleCounts); // Add this line for debugging

        Object.keys(roleCounts).forEach(role => {
            const count = roleCounts[role];
            const roleDiv = document.createElement('div');
            roleDiv.innerHTML = `<label>${role} x${count}</label>`;
            roleSelectionContainer.appendChild(roleDiv);
        });
    }

    function getPresetRoles(playerCount) {
        // 这可以是一个更复杂的配置表
        if (playerCount === 12) return ['狼人', '狼人', '狼人', '狼人', '预言家', '女巫', '猎人', '白痴', '平民', '平民', '平民', '平民'];
        if (playerCount === 6) return ['预言家', '女巫', '猎人', '狼人', '狼人', '平民'];
        if (playerCount === 7) return ['预言家', '女巫', '猎人', '狼人', '狼人', '平民', '平民'];
        if (playerCount >= 8 && playerCount < 12) {
            const roles = ['预言家', '女巫', '猎人', '白痴', '狼人', '狼人', '狼人'];
            while (roles.length < playerCount) {
                roles.push('平民');
            }
            return roles;
        }
        return []; // 默认
    }

    playerCountInput.addEventListener('change', renderRoleSelection);

    // 开始游戏
    startGameButton.addEventListener('click', () => {
        console.log('Start Game button clicked');
        const playerCount = parseInt(playerCountInput.value);
        const rolesToAssign = getPresetRoles(playerCount);

        console.log('Player Count:', playerCount);
        console.log('Roles to Assign Length:', rolesToAssign.length);

        if (rolesToAssign.length !== playerCount) {
            showModal(`当前为${playerCount}人配置的角色数量为 ${rolesToAssign.length}，不匹配，请重新配置。`, 'info');
            return;
        }

        initializeGame(playerCount, rolesToAssign);
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
        log('游戏开始！角色已秘密分配。', 'info');
        currentPrompt.textContent = '游戏开始！角色已秘密分配。';
        console.log('Current Prompt set to:', currentPrompt.textContent);
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
        currentPrompt.textContent = '天亮了，请睁眼。';
        log('天亮了，请睁眼。', 'info');

        const afterDeathProcessing = () => {
            if (checkForWinner()) return;
            log('请玩家发言并准备投票。', 'info');
            setupPlayerSelection(player => player.isAlive && !player.isRevealedIdiot, (selectedId) => {
                handleVote(selectedId);
            }, '投票淘汰该玩家');
        };

        // 在第一天且警长空缺时处理警长竞选
        if (gameState.day === 1 && !gameState.players.some(p => p.isSheriff)) {
            handleSheriffElection(() => {
                processPendingDeaths(afterDeathProcessing);
            });
        } else {
            processPendingDeaths(afterDeathProcessing);
        }
    }

    // 处理投票结果
    function handleVote(votedId) {
        const player = gameState.players.find(p => p.id === votedId);
        if (player) {
            log(`${player.id} 号玩家被投票出局，身份是 ${player.role}。`, 'action');

            if (player.role === '白痴') {
                player.isRevealedIdiot = true;
                log('白痴翻牌，保留在场上但失去投票权。', 'info');
                if (player.isSheriff) {
                    player.isSheriff = false;
                    log('白痴警长被投票出局，警徽被撕毁，请在下一个白天重新竞选警长。', 'info');
                }
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
            } else if (player.isSheriff) {
                handleSheriffTransfer(() => {
                    if (checkForWinner()) return;
                    startNextNext();
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
        currentPrompt.textContent = '黑夜降临，请等待主持人指示。';
        gameState.victim = null;
        gameState.poisonedTarget = null;
        gameState.pendingDeaths = [];

        const wolves = gameState.players.filter(p => p.role === '狼人' && p.isAlive);
        const prophet = gameState.players.find(p => p.role === '预言家' && p.isAlive);
        const witch = gameState.players.find(p => p.role === '女巫' && p.isAlive);

        // 简单的队列来处理行动顺序
        const nightActions = [handleWolvesAction, handleProphetAction, handleWitchAction];


        nightActions.push((callback) => {
            log('黑夜结束。', 'info');

            if (gameState.poisonedTarget && gameState.poisonedTarget === gameState.victim) {
                gameState.victim = null;
            }

            if (gameState.poisonedTarget) {
                gameState.pendingDeaths.push({ id: gameState.poisonedTarget, reason: '被毒杀' });
            }
            if (gameState.victim) {
                gameState.pendingDeaths.push({ id: gameState.victim, reason: '被狼人淘汰' });
            }

            gameState.phase = 'day';
            runGameLoop();
            callback();
        });

        // ... (night actions execution) ...
        let currentActionIndex = 0;
        function nextAction() {
            if (currentActionIndex < nightActions.length) {
                nightActions[currentActionIndex++](nextAction);
            }
        }
        nextAction();
    }

    function processPendingDeaths(callback) {
        const deathAnnouncements = [];
        let hunterDied = false;
        let sheriffDied = false;

        gameState.pendingDeaths.forEach(death => {
            const player = gameState.players.find(p => p.id === death.id);
            if (player && player.isAlive) {
                player.isAlive = false;
                deathAnnouncements.push(`${player.id} 号玩家昨晚因 ${death.reason} 而出局`);
                if (player.role === '猎人') hunterDied = true;
                if (player.isSheriff) sheriffDied = true;
            }
        });

        if (deathAnnouncements.length === 0) {
            log('昨晚是平安夜。', 'info');
        } else {
            log(deathAnnouncements.join('，') + '。', 'death');
        }

        renderPlayers(gameState.players);

        const continueAfterDeaths = () => {
            if (hunterDied) {
                handleHunterSkill(() => {
                    if (checkForWinner()) return;
                    callback();
                });
            } else {
                callback();
            }
        };

        if (sheriffDied) {
            handleSheriffTransfer(continueAfterDeaths);
        } else {
            continueAfterDeaths();
        }
    }

    function handleWolvesAction(callback) {
        const wolves = gameState.players.filter(p => p.role === '狼人' && p.isAlive);
        if (wolves.length === 0) {
            currentPrompt.textContent = '狼人已全部出局，今晚平安。';
            log('狼人已全部出局，今晚平安。', 'info');
            callback();
            return;
        }
        currentPrompt.textContent = '狼人请睁眼，请选择要淘汰的玩家。';
        log('狼人请睁眼，请选择要淘汰的玩家。', 'action');
        setupPlayerSelection(player => player.isAlive, (selectedId) => {
            gameState.victim = selectedId;
            log(`狼人选择了 ${selectedId} 号玩家。`, 'action');
            callback();
        });
    }

    function handleProphetAction(callback) {
        const prophet = gameState.players.find(p => p.role === '预言家' && p.isAlive);
        if (!prophet) {
            currentPrompt.textContent = '预言家已出局，请跳过此环节。';
            log('预言家已出局，请跳过此环节。', 'info');
            clearActionControls();
            const skipButton = document.createElement('button');
            skipButton.textContent = '跳过';
            skipButton.onclick = () => callback();
            actionControls.appendChild(skipButton);
            return;
        }
        currentPrompt.textContent = '预言家请睁眼，请选择要查验的玩家。';
        log('预言家请睁眼，请选择要查验的玩家。', 'action');
        setupPlayerSelection(player => player.isAlive, (selectedId) => {
            const targetPlayer = gameState.players.find(p => p.id === selectedId);
            const isWolf = targetPlayer.role === '狼人';
            showModal(`查验结果：${selectedId} 号玩家是 ${isWolf ? '狼人' : '好人'}。`, () => {
                log(`预言家查验了 ${selectedId} 号玩家。`, 'action');
                callback();
            });
        });
    }

    function handleWitchAction(callback) {
        const witch = gameState.players.find(p => p.role === '女巫' && p.isAlive);
        if (!witch) {
            currentPrompt.textContent = '女巫已出局。';
            log('女巫已出局。', 'info');
            callback();
            return;
        }

        currentPrompt.textContent = '女巫请睁眼。';
        log('女巫请睁眼。', 'action');
        clearActionControls();

        const doPoisonPhase = () => {
            clearActionControls(); // Clear save/skip buttons

            const poisonButton = document.createElement('button');
            poisonButton.textContent = '使用毒药';
            if (gameState.witchUsedPoison) {
                poisonButton.classList.add('disabled-button');
                poisonButton.disabled = true;
                poisonButton.onclick = () => showModal('毒药已用。', () => {});
            } else {
                poisonButton.onclick = () => {
                    setupPlayerSelection(p => p.isAlive, (poisonedId) => {
                        gameState.poisonedTarget = poisonedId;
                        gameState.witchUsedPoison = true;
                        log(`女巫使用了毒药，选择了 ${poisonedId} 号玩家。`, 'action');
                        callback(); // Complete witch's turn
                    }, '选择下毒目标');
                };
            }
            actionControls.appendChild(poisonButton);

            const skipPoisonButton = document.createElement('button');
            skipPoisonButton.textContent = '跳过';
            skipPoisonButton.onclick = () => callback(); // Skip poison, complete witch's turn
            actionControls.appendChild(skipPoisonButton);
        };

        // Save phase
        const saveButton = document.createElement('button');
        saveButton.textContent = '使用解药';
        if (!gameState.victim || gameState.witchUsedSave) {
            saveButton.classList.add('disabled-button');
            saveButton.disabled = true;
            saveButton.onclick = () => {
                if (!gameState.victim) {
                    showModal('昨晚是平安夜，无人倒牌。', () => {});
                } else {
                    showModal('解药已用。', () => {});
                }
            };
        } else {
            saveButton.onclick = () => {
                log(`女巫使用了灵药，救了 ${gameState.victim} 号玩家。`, 'action');
                gameState.victim = null; // Saved
                gameState.witchUsedSave = true;
                doPoisonPhase(); // Proceed to poison phase
            };
        }
        actionControls.appendChild(saveButton);

        const skipSaveButton = document.createElement('button');
        skipSaveButton.textContent = '跳过';
        skipSaveButton.onclick = () => doPoisonPhase(); // Skip save, proceed to poison phase
        actionControls.appendChild(skipSaveButton);
    }

    function handleSheriffTransfer(callback) {
        currentPrompt.textContent = '警长已死亡。请主持人选择一名玩家移交警徽，或撕毁警徽。';
        log('警长已死亡。请主持人选择一名玩家移交警徽，然后点击“确认移交”；或者点击“撕毁警徽”。', 'action');
        clearActionControls();

        setupPlayerSelection(p => p.isAlive, (newSheriffId) => {
            const oldSheriff = gameState.players.find(p => p.isSheriff);
            if (oldSheriff) oldSheriff.isSheriff = false;

            const newSheriff = gameState.players.find(p => p.id === newSheriffId);
            newSheriff.isSheriff = true;
            log(`警徽已移交给 ${newSheriffId} 号玩家。`, 'action');
            renderPlayers(gameState.players);
            callback();
        }, '确认移交');

        const tearUpButton = document.createElement('button');
        tearUpButton.textContent = '撕毁警徽';
        tearUpButton.onclick = () => {
            const oldSheriff = gameState.players.find(p => p.isSheriff);
            if (oldSheriff) oldSheriff.isSheriff = false;
            log('警徽已被撕毁。', 'action');
            renderPlayers(gameState.players);
            clearActionControls();
            callback();
        };
        actionControls.appendChild(tearUpButton);
    }

    function handleSheriffElection(callback) {
        currentPrompt.textContent = '请进行警长竞选。请选择所有参与竞选的玩家。';
        log('请进行警长竞选。请选择所有参与竞选的玩家。', 'action');
        let candidates = [];
        clearActionControls();

        document.querySelectorAll('.player-card').forEach(card => {
            const playerId = parseInt(card.dataset.playerId);
            const player = gameState.players.find(p => p.id === playerId);
            if (player.isAlive) {
                card.classList.add('selectable');
                card.onclick = () => {
                    card.classList.toggle('selected');
                    if (candidates.includes(playerId)) {
                        candidates = candidates.filter(id => id !== playerId);
                    } else {
                        candidates.push(playerId);
                    }
                };
            }
        });

        const confirmCandidatesButton = document.createElement('button');
        confirmCandidatesButton.textContent = '确认候选人';
        confirmCandidatesButton.onclick = () => {
            if (candidates.length === 0) {
                showModal('请至少选择一名候选人。', 'info');
                return;
            }
            log(`警长候选人是: ${candidates.join(', ')} 号。`, 'info');
            clearPlayerSelection();
            setupSheriffVoting(candidates, callback);
        };
        actionControls.appendChild(confirmCandidatesButton);
    }

    function setupSheriffVoting(candidates, callback) {
        sheriffVoteArea.classList.remove('hidden');
        sheriffCandidatesList.innerHTML = '';
        let votes = {};

        candidates.sort((a, b) => a - b); // 确保顺序

        candidates.forEach(candidateId => {
            votes[candidateId] = 0;
            const candidateDiv = document.createElement('div');
            candidateDiv.className = 'candidate-vote-control';
            candidateDiv.innerHTML = `
                <span>玩家 ${candidateId}</span>
                <button class="vote-minus" data-id="${candidateId}">-</button>
                <span class="vote-count" data-id="${candidateId}">0</span>
                <button class="vote-plus" data-id="${candidateId}">+</button>
            `;
            sheriffCandidatesList.appendChild(candidateDiv);
        });

        sheriffCandidatesList.querySelectorAll('.vote-plus').forEach(button => {
            button.onclick = (e) => {
                const id = parseInt(e.target.dataset.id);
                votes[id]++;
                e.target.previousElementSibling.textContent = votes[id];
            };
        });

        sheriffCandidatesList.querySelectorAll('.vote-minus').forEach(button => {
            button.onclick = (e) => {
                const id = parseInt(e.target.dataset.id);
                if (votes[id] > 0) {
                    votes[id]--;
                    e.target.nextElementSibling.textContent = votes[id];
                }
            };
        });

        confirmSheriffVoteButton.onclick = () => {
            let maxVotes = -1;
            let electedSheriffId = -1;
            let tie = false;

            for (const candidateId in votes) {
                if (votes[candidateId] > maxVotes) {
                    maxVotes = votes[candidateId];
                    electedSheriffId = parseInt(candidateId);
                    tie = false;
                } else if (votes[candidateId] === maxVotes) {
                    tie = true;
                }
            }

            if (electedSheriffId !== -1 && !tie) {
                const sheriff = gameState.players.find(p => p.id === electedSheriffId);
                sheriff.isSheriff = true;
                log(`${sheriff.id} 号玩家当选为警长！`, 'action');
                renderPlayers(gameState.players);
                sheriffVoteArea.classList.add('hidden');
                callback();
            } else if (tie) {
                showModal('警长投票出现平票，请重新投票或协商。', 'info');
            } else {
                showModal('没有选出警长，请重新投票。', 'info');
            }
        };
    }

    function voteForSheriff(candidates, callback) { // 这个函数现在是多余的，会被setupSheriffVoting取代
        // 确保候选人按ID顺序排序，以便询问票数时顺序一致
        candidates.sort((a, b) => a - b);
        candidates.forEach(c => votes[c] = 0);

        // 简化处理：直接弹出prompt收集票数
        candidates.forEach(candidateId => {
            const voteCount = prompt(`请输入 ${candidateId} 号候选人的票数:`, "0");
            votes[candidateId] = parseInt(voteCount) || 0;
        });

        let maxVotes = -1;
        let electedSheriffId = -1;
        for (const candidateId in votes) {
            if (votes[candidateId] > maxVotes) {
                maxVotes = votes[candidateId];
                electedSheriffId = parseInt(candidateId);
            }
        }

        if (electedSheriffId !== -1) {
            const sheriff = gameState.players.find(p => p.id === electedSheriffId);
            sheriff.isSheriff = true;
            log(`${sheriff.id} 号玩家当选为警长！`, 'action');
            renderPlayers(gameState.players);
        }
        callback();
    }

    function handleHunterSkill(callback) {
        const hunter = gameState.players.find(p => p.role === '猎人' && !p.isAlive); // Find the dead hunter
        const isPoisoned = gameState.pendingDeaths.some(death => death.id === hunter.id && death.reason === '被毒杀');

        if (isPoisoned) {
            log('猎人被毒死，无法开枪。', 'info');
            callback();
            return;
        }

        log('猎人被淘汰，请选择一名玩家开枪带走。', 'action');
        setupPlayerSelection(p => p.isAlive, (shotId) => {
            const shotPlayer = gameState.players.find(p => p.id === shotId);
            if (shotPlayer) {
                shotPlayer.isAlive = false;
                log(`猎人开枪带走了 ${shotPlayer.id} 号玩家。`, 'action');
                renderPlayers(gameState.players);

                if (shotPlayer.isSheriff) {
                    handleSheriffTransfer(callback);
                } else {
                    callback();
                }
            } else {
                callback();
            }
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
                const confirmedId = selectedPlayerId;
                clearPlayerSelection();
                clearActionControls();
                onConfirm(confirmedId);
            } else {
                showModal('请选择一个玩家。', 'info');
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
        const aliveGods = alivePlayers.filter(p => ['预言家', '女巫', '猎人', '白痴'].includes(p.role));
        const aliveVillagers = alivePlayers.filter(p => p.role === '平民');

        let totalGoodVotes = 0;
        alivePlayers.forEach(player => {
            if (player.role !== '狼人') { // 好人阵营
                if (player.isSheriff) {
                    totalGoodVotes += 1.5; // 警长1.5票
                } else {
                    totalGoodVotes += 1; // 普通玩家1票
                }
            }
        });

        let winner = null;
        let reason = '';

        // 好人阵营胜利条件：所有狼人出局
        if (aliveWolves.length === 0) {
            winner = '好人阵营';
            reason = '所有狼人已被淘汰';
        }
        // 狼人阵营胜利条件：
        // 1. 狼人数量达到或超过好人有效票数
        // 2. 所有平民出局 (屠边)
        // 3. 所有神职出局 (屠边)
        else if (aliveWolves.length >= totalGoodVotes) {
            winner = '狼人阵营';
            reason = '狼人数量已达到或超过好人数量';
        } else if (aliveVillagers.length === 0) {
            winner = '狼人阵营';
            reason = '所有平民已被淘汰';
        } else if (aliveGods.length === 0) {
            winner = '狼人阵营';
            reason = '所有神职已被淘汰';
        }

        if (winner) {
            const victoryMessage = `游戏结束，${reason}，${winner}胜利！`;
            gamePhaseTitle.textContent = `${winner}胜利！`;
            log(victoryMessage, 'info');
            showModal(victoryMessage);
            clearActionControls();
            // 禁用所有未来的操作
            gameState.phase = 'gameover';
            return true;
        }
        return false;
    }

    // 分配角色
    function assignRoles(playerCount, rolesToAssign) {
        // 打乱角色数组
        const shuffledRoles = rolesToAssign.sort(() => Math.random() - 0.5);

        const players = [];
        for (let i = 1; i <= playerCount; i++) {
            players.push({
                id: i,
                role: shuffledRoles[i - 1],
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
            pendingDeaths: [],
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
            if (player.isSheriff) {
                playerCard.classList.add('sheriff');
                playerCard.innerHTML += '<span class="sheriff-badge">&#128081;</span>'; // 警徽图标
            }

            playerCard.innerHTML = `<h3>玩家 ${player.id}</h3><div class="role">${player.role}</div>`;
            
            playerList.appendChild(playerCard);
        });
    }

    // 记录日志
    function log(message, type = 'info') {
        const li = document.createElement('li');
        const now = new Date();
        const timestamp = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
        li.textContent = `${timestamp} ${message}`;
        li.classList.add(`log-${type}`);
        logList.prepend(li);
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
