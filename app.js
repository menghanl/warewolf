document.addEventListener('DOMContentLoaded', () => {
    // i18n
    let translations = {};
    let currentLang = 'zh-CN';

    // DOM Elements
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
    const langZhButton = document.getElementById('lang-zh');
    const langEnButton = document.getElementById('lang-en');
    const actionControls = document.getElementById('action-controls');

    // Game State
    let gameState = {};
    let selectedPlayerId = null;

    // --- I18n Functions ---
    async function loadTranslations(lang) {
        try {
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load ${lang}.json`);
            }
            translations = await response.json();
        } catch (error) {
            console.error("Error loading translations:", error);
            // Fallback to Chinese on error
            if (lang !== 'zh-CN') {
                await loadTranslations('zh-CN');
            }
        }
    }

    function t(key, ...args) {
        let text = key.split('.').reduce((obj, k) => (obj && obj[k] !== 'undefined') ? obj[k] : key, translations);
        if (args.length > 0) {
            args.forEach((arg, i) => {
                text = text.replace(`{${i}}`, arg);
            });
        }
        return text;
    }

    function updateUI() {
        document.querySelectorAll('[data-i18n-key]').forEach(el => {
            const key = el.getAttribute('data-i18n-key');
            // For elements like <title>, we set textContent. For buttons, we might also set textContent.
            // This handles most cases.
            el.textContent = t(key);
        });
        // Specific updates for dynamic content
        renderRoleSelection();
        if (gameState.players) {
            renderPlayers(gameState.players);
        }
    }

    async function setLanguage(lang) {
        currentLang = lang;
        await loadTranslations(lang);
        localStorage.setItem('preferredLang', lang);
        document.documentElement.lang = lang.split('-')[0];
        
        langZhButton.classList.toggle('active', lang === 'zh-CN');
        langEnButton.classList.toggle('active', lang === 'en-US');
        
        updateUI();
    }

    // --- Game Logic ---

    const roleOrder = ['wolfman', 'prophet', 'witch', 'hunter', 'stupid', 'villager'];
    const roleImageMap = {
        'villager': 'villager.png',
        'prophet': 'prophet.png',
        'witch': 'witch.png',
        'hunter': 'hunter.png',
        'stupid': 'stupid.png',
        'wolfman': 'wolfman.png'
    };

    function showModal(key, callback, ...args) {
        modalText.textContent = t(key, ...args);
        modal.classList.remove('hidden');
        modalClose.onclick = () => {
            modal.classList.add('hidden');
            if (callback) callback();
        };
    }

    function renderRoleSelection() {
        roleSelectionContainer.innerHTML = '';
        const playerCount = parseInt(playerCountInput.value) || 12;
        const roles = getPresetRoles(playerCount);

        const roleCounts = roles.reduce((acc, role) => {
            acc[role] = (acc[role] || 0) + 1;
            return acc;
        }, {});

        roleOrder.forEach(roleKey => {
            const count = roleCounts[roleKey] || 0;
            if (count > 0) {
                const roleDiv = document.createElement('div');
                const imageUrl = `images/roles/${roleImageMap[roleKey]}`;
                const roleName = t(`roles.${roleKey}`);
                roleDiv.innerHTML = `<label><img src="${imageUrl}" alt="${roleName}" class="role-icon"><div class="role-name">${roleName}</div><div class="role-count">x${count}</div></label>`;
                roleSelectionContainer.appendChild(roleDiv);
            }
        });
    }

    function getPresetRoles(playerCount) {
        // Returns English keys for roles
        if (playerCount === 6) return ['wolfman', 'wolfman', 'prophet', 'witch', 'villager', 'villager'];
        if (playerCount === 7) return ['wolfman', 'wolfman', 'prophet', 'witch', 'villager', 'villager', 'villager'];
        if (playerCount === 8) return ['wolfman', 'wolfman', 'witch', 'prophet', 'hunter', 'villager', 'villager', 'villager'];
        if (playerCount === 9) return ['wolfman', 'wolfman', 'wolfman', 'witch', 'prophet', 'hunter', 'villager', 'villager', 'villager'];
        if (playerCount === 10) return ['wolfman', 'wolfman', 'wolfman', 'witch', 'prophet', 'hunter', 'villager', 'villager', 'villager', 'villager'];
        if (playerCount === 11) return ['wolfman', 'wolfman', 'wolfman', 'witch', 'prophet', 'hunter', 'stupid', 'villager', 'villager', 'villager', 'villager'];
        if (playerCount === 12) return ['wolfman', 'wolfman', 'wolfman', 'wolfman', 'witch', 'prophet', 'hunter', 'stupid', 'villager', 'villager', 'villager', 'villager'];
        return [];
    }

    startGameButton.addEventListener('click', () => {
        const playerCount = parseInt(playerCountInput.value);
        const rolesToAssign = getPresetRoles(playerCount);

        if (rolesToAssign.length === 0) {
            showModal('error.unsupportedPlayerCount', null, playerCount);
            return;
        } else if (rolesToAssign.length !== playerCount) {
            showModal('error.roleMismatch', null, playerCount, rolesToAssign.length);
            return;
        }

        initializeGame(playerCount, rolesToAssign);
    });

    function initializeGame(playerCount, selectedRoles) {
        gameSetup.classList.add('hidden');
        gameBoard.classList.remove('hidden');

        gameState = assignRoles(playerCount, selectedRoles);
        renderPlayers(gameState.players);
        log('log.gameStarted');
        currentPrompt.textContent = t('prompt.gameStarted');
        runGameLoop();
    }

    function runGameLoop() {
        const { phase, day } = gameState;
        if (phase === 'night') {
            gamePhaseTitle.textContent = t('gamePhase.night', day);
            gamePhaseTitle.classList.remove('day-phase-bg');
            gamePhaseTitle.classList.add('night-phase-bg');
            handleNightPhase();
        } else if (phase === 'day') {
            gamePhaseTitle.textContent = t('gamePhase.day', day);
            gamePhaseTitle.classList.remove('night-phase-bg');
            gamePhaseTitle.classList.add('day-phase-bg');
            handleDayPhase();
        }
    }

    function handleDayPhase() {
        currentPrompt.textContent = t('prompt.daylight');
        log('log.daylight');

        const afterDeathProcessing = () => {
            if (checkForWinner()) return;
            log('log.discussAndVote');
            setupPlayerSelection(player => player.isAlive && !player.isRevealedIdiot, (selectedId) => {
                handleVote(selectedId);
            }, t('button.voteOut'));
        };

        if (gameState.day === 1 && !gameState.players.some(p => p.isSheriff)) {
            handleSheriffElection(() => {
                processPendingDeaths(afterDeathProcessing);
            });
        } else {
            processPendingDeaths(afterDeathProcessing);
        }
    }

    function handleVote(votedId) {
        const player = gameState.players.find(p => p.id === votedId);
        if (player) {
            log('log.votedOut', 'action', player.id, t(`roles.${player.role}`));

            if (player.role === 'stupid') {
                player.isRevealedIdiot = true;
                log('log.idiotRevealed', 'info');
                if (player.isSheriff) {
                    player.isSheriff = false;
                    log('log.idiotSheriffVotedOut', 'info');
                }
                renderPlayers(gameState.players);
                if (checkForWinner()) return;
                startNextNight();
                return;
            }

            player.isAlive = false;
            renderPlayers(gameState.players);

            if (player.role === 'hunter') {
                handleHunterSkill(() => {
                    if (checkForWinner()) return;
                    startNextNight();
                });
            } else if (player.isSheriff) {
                handleSheriffTransfer(() => {
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

    function handleNightPhase() {
        currentPrompt.textContent = t('prompt.nightfall');
        gameState.victim = null;
        gameState.poisonedTarget = null;
        gameState.pendingDeaths = [];

        const nightActions = [handleWolvesAction, handleProphetAction, handleWitchAction];

        nightActions.push(() => {
            log('log.nightEnd');

            if (gameState.poisonedTarget && gameState.poisonedTarget === gameState.victim) {
                gameState.victim = null;
            }

            if (gameState.poisonedTarget) {
                gameState.pendingDeaths.push({ id: gameState.poisonedTarget, reason: t('reason.poisoned') });
            }
            if (gameState.victim) {
                gameState.pendingDeaths.push({ id: gameState.victim, reason: t('reason.wolf') });
            }

            gameState.phase = 'day';
            runGameLoop();
        });

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
                deathAnnouncements.push(t('log.playerDiedLastNight', player.id, death.reason));
                if (player.role === 'hunter') hunterDied = true;
                if (player.isSheriff) sheriffDied = true;
            }
        });

        if (deathAnnouncements.length === 0) {
            log('log.safeNight', 'info');
        } else {
            log('log.deathAnnouncements', 'death', deathAnnouncements.join(t('misc.joiner')));
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
        const wolves = gameState.players.filter(p => p.role === 'wolfman' && p.isAlive);
        if (wolves.length === 0) {
            currentPrompt.textContent = t('prompt.wolvesAllOut');
            log('log.wolvesAllOut', 'info');
            callback();
            return;
        }
        currentPrompt.textContent = t('prompt.wolvesAction');
        log('log.wolvesAction', 'action');
        setupPlayerSelection(player => player.isAlive, (selectedId) => {
            gameState.victim = selectedId;
            log('log.wolvesSelected', 'action', selectedId);
            callback();
        });
    }

    function handleProphetAction(callback) {
        const prophet = gameState.players.find(p => p.role === 'prophet' && p.isAlive);
        if (!prophet) {
            currentPrompt.textContent = t('prompt.prophetIsOut');
            log('log.prophetIsOut', 'info');
            clearActionControls();
            const skipButton = document.createElement('button');
            skipButton.textContent = t('button.skip');
            skipButton.onclick = () => callback();
            actionControls.appendChild(skipButton);
            return;
        }
        currentPrompt.textContent = t('prompt.prophetAction');
        log('log.prophetAction', 'action');
        setupPlayerSelection(player => player.isAlive, (selectedId) => {
            const targetPlayer = gameState.players.find(p => p.id === selectedId);
            const isWolf = targetPlayer.role === 'wolfman';
            const result = isWolf ? t('misc.wolf') : t('misc.good');
            showModal('modal.prophetResult', () => {
                log('log.prophetChecked', 'action', selectedId);
                callback();
            }, selectedId, result);
        });
    }

    function handleWitchAction(callback) {
        const witch = gameState.players.find(p => p.role === 'witch' && p.isAlive);
        if (!witch) {
            currentPrompt.textContent = t('prompt.witchIsOut');
            log('log.witchIsOut', 'info');
            callback();
            return;
        }

        currentPrompt.textContent = t('prompt.witchAction');
        log('log.witchAction', 'action');
        if (gameState.victim) {
            log('log.witchVictimInfo', 'info', gameState.victim);
        }
        clearActionControls();

        const doPoisonPhase = () => {
            clearActionControls();

            const poisonButton = document.createElement('button');
            poisonButton.textContent = t('button.usePoison');
            if (gameState.witchUsedPoison) {
                poisonButton.classList.add('disabled-button');
                poisonButton.disabled = true;
                poisonButton.onclick = () => showModal('modal.poisonUsed');
            } else {
                poisonButton.onclick = () => {
                    setupPlayerSelection(p => p.isAlive, (poisonedId) => {
                        gameState.poisonedTarget = poisonedId;
                        gameState.witchUsedPoison = true;
                        log('log.witchUsedPoison', 'action', poisonedId);
                        callback();
                    }, t('button.selectPoisonTarget'));
                };
            }
            actionControls.appendChild(poisonButton);

            const skipPoisonButton = document.createElement('button');
            skipPoisonButton.textContent = t('button.skip');
            skipPoisonButton.onclick = () => callback();
            actionControls.appendChild(skipPoisonButton);
        };

        const saveButton = document.createElement('button');
        saveButton.textContent = t('button.useAntidote');
        const witchPlayer = gameState.players.find(p => p.role === 'witch');
        const isWitchVictim = gameState.victim === witchPlayer.id;

        if (!gameState.victim || gameState.witchUsedSave || isWitchVictim) {
            saveButton.classList.add('disabled-button');
            saveButton.disabled = true;
            saveButton.onclick = () => {
                if (!gameState.victim) showModal('modal.noVictim');
                else if (gameState.witchUsedSave) showModal('modal.antidoteUsed');
                else if (isWitchVictim) showModal('modal.witchCannotSaveSelf');
            };
        } else {
            saveButton.onclick = () => {
                log('log.witchUsedAntidote', 'action', gameState.victim);
                gameState.victim = null;
                gameState.witchUsedSave = true;
                doPoisonPhase();
            };
        }
        actionControls.appendChild(saveButton);

        const skipSaveButton = document.createElement('button');
        skipSaveButton.textContent = t('button.skip');
        skipSaveButton.onclick = () => doPoisonPhase();
        actionControls.appendChild(skipSaveButton);
    }

    function handleSheriffTransfer(callback) {
        currentPrompt.textContent = t('prompt.sheriffDied');
        log('log.sheriffDied', 'action');
        clearActionControls();

        setupPlayerSelection(p => p.isAlive, (newSheriffId) => {
            const oldSheriff = gameState.players.find(p => p.isSheriff);
            if (oldSheriff) oldSheriff.isSheriff = false;

            const newSheriff = gameState.players.find(p => p.id === newSheriffId);
            newSheriff.isSheriff = true;
            log('log.sheriffTransferred', 'action', newSheriffId);
            renderPlayers(gameState.players);
            callback();
        }, t('button.confirmTransfer'));

        const tearUpButton = document.createElement('button');
        tearUpButton.textContent = t('button.tearUpBadge');
        tearUpButton.onclick = () => {
            const oldSheriff = gameState.players.find(p => p.isSheriff);
            if (oldSheriff) oldSheriff.isSheriff = false;
            log('log.badgeTornUp', 'action');
            renderPlayers(gameState.players);
            clearActionControls();
            callback();
        };
        actionControls.appendChild(tearUpButton);
    }

    function handleSheriffElection(callback) {
        currentPrompt.textContent = t('prompt.sheriffElection');
        log('log.sheriffElection', 'action');
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
        confirmCandidatesButton.textContent = t('button.confirmCandidates');
        confirmCandidatesButton.onclick = () => {
            if (candidates.length === 0) {
                showModal('modal.selectOneCandidate');
                return;
            }
            log('log.sheriffCandidates', 'info', candidates.join(', '));
            clearPlayerSelection();
            setupSheriffVoting(candidates, callback);
        };
        actionControls.appendChild(confirmCandidatesButton);
    }

    function setupSheriffVoting(candidates, callback) {
        sheriffVoteArea.classList.remove('hidden');
        sheriffCandidatesList.innerHTML = '';
        let votes = {};

        candidates.sort((a, b) => a - b);

        candidates.forEach(candidateId => {
            votes[candidateId] = 0;
            const candidateDiv = document.createElement('div');
            candidateDiv.className = 'candidate-vote-control';
            candidateDiv.innerHTML = `
                <span>${t('misc.player')} ${candidateId}</span>
                <button class="vote-minus" data-id="${candidateId}">-</button>
                <span class="vote-count" data-id="${candidateId}">0</span>
                <button class="vote-plus" data-id="${candidateId}">+</button>
            `;
            sheriffCandidatesList.appendChild(candidateDiv);
        });

        sheriffCandidatesList.querySelectorAll('.vote-plus, .vote-minus').forEach(button => {
            button.onclick = (e) => {
                const id = parseInt(e.target.dataset.id);
                if (e.target.classList.contains('vote-plus')) {
                    votes[id]++;
                } else if (votes[id] > 0) {
                    votes[id]--;
                }
                e.target.parentElement.querySelector('.vote-count').textContent = votes[id];
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
                log('log.sheriffElected', 'action', sheriff.id);
                renderPlayers(gameState.players);
                sheriffVoteArea.classList.add('hidden');
                callback();
            } else if (tie) {
                showModal('modal.tieVote');
            } else {
                showModal('modal.noSheriffElected');
            }
        };
    }

    function handleHunterSkill(callback) {
        const hunter = gameState.players.find(p => p.role === 'hunter' && !p.isAlive);
        const isPoisoned = gameState.pendingDeaths.some(death => death.id === hunter.id && death.reason === t('reason.poisoned'));

        if (isPoisoned) {
            log('log.hunterPoisoned', 'info');
            callback();
            return;
        }

        log('log.hunterAction', 'action');
        setupPlayerSelection(p => p.isAlive, (shotId) => {
            const shotPlayer = gameState.players.find(p => p.id === shotId);
            if (shotPlayer) {
                shotPlayer.isAlive = false;
                log('log.hunterShot', 'action', shotPlayer.id);
                renderPlayers(gameState.players);

                if (shotPlayer.isSheriff) {
                    handleSheriffTransfer(callback);
                } else {
                    callback();
                }
            } else {
                callback();
            }
        }, t('button.confirmShot'));
    }

    function setupPlayerSelection(filterFunc, onConfirm, buttonText) {
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
        confirmButton.textContent = buttonText || t('button.confirmSelection');
        confirmButton.onclick = () => {
            if (selectedPlayerId) {
                const confirmedId = selectedPlayerId;
                clearPlayerSelection();
                clearActionControls();
                onConfirm(confirmedId);
            } else {
                showModal('modal.selectPlayer');
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
        const aliveWolves = alivePlayers.filter(p => p.role === 'wolfman');
        const aliveGods = alivePlayers.filter(p => ['prophet', 'witch', 'hunter', 'stupid'].includes(p.role));
        const aliveVillagers = alivePlayers.filter(p => p.role === 'villager');

        let winner = null;
        let reasonKey = '';

        if (aliveWolves.length === 0) {
            winner = t('winner.good');
            reasonKey = 'reason.allWolvesEliminated';
        } else if (aliveVillagers.length === 0) {
            winner = t('winner.werewolves');
            reasonKey = 'reason.allVillagersEliminated';
        } else if (aliveGods.length === 0) {
            winner = t('winner.werewolves');
            reasonKey = 'reason.allGodsEliminated';
        }

        if (winner) {
            const reason = t(reasonKey);
            const victoryMessage = t('log.gameOver', reason, winner);
            gamePhaseTitle.textContent = t('gamePhase.gameOver', winner);
            log('log.gameOverLog', 'info', reason, winner);
            showModal('modal.gameOver', null, reason, winner);
            clearActionControls();
            gameState.phase = 'gameover';
            return true;
        }
        return false;
    }

    function assignRoles(playerCount, rolesToAssign) {
        const shuffledRoles = rolesToAssign.sort(() => Math.random() - 0.5);
        const players = [];
        for (let i = 1; i <= playerCount; i++) {
            players.push({
                id: i,
                role: shuffledRoles[i - 1], // role is the English key
                isAlive: true,
                isSheriff: false,
                isRevealedIdiot: false,
            });
        }
        return {
            players,
            day: 1,
            phase: 'night',
            witchUsedSave: false,
            witchUsedPoison: false,
            victim: null,
            poisonedTarget: null,
            pendingDeaths: [],
        };
    }

    function renderPlayers(players) {
        playerList.innerHTML = '';
        players.forEach(player => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-card';
            playerCard.dataset.playerId = player.id;
            if (!player.isAlive) playerCard.classList.add('dead');
            if (player.isRevealedIdiot) playerCard.classList.add('revealed-idiot');
            if (player.isSheriff) playerCard.classList.add('sheriff');

            const civilianRoles = ['villager'];
            const godRoles = ['prophet', 'witch', 'hunter', 'stupid'];
            if (civilianRoles.includes(player.role)) playerCard.classList.add('civilian-alignment');
            else if (godRoles.includes(player.role)) playerCard.classList.add('god-alignment');
            else if (player.role === 'wolfman') playerCard.classList.add('wolf-alignment');

            let roleDisplay = t(`roles.${player.role}`);
            const roleIcons = { prophet: '🔮', witch: '🧙', hunter: '🏹', stupid: '🃏' };
            if (roleIcons[player.role]) {
                roleDisplay += ` ${roleIcons[player.role]}`;
            }

            playerCard.innerHTML = `<h3>${t('misc.player')} ${player.id}</h3><div class="role">${roleDisplay}</div>`;

            if (player.isSheriff) {
                const sheriffBadge = document.createElement('span');
                sheriffBadge.className = 'sheriff-badge';
                sheriffBadge.innerHTML = '&#128081;';
                playerCard.appendChild(sheriffBadge);
            }
            
            playerList.appendChild(playerCard);
        });
    }

    function log(key, type = 'info', ...args) {
        const li = document.createElement('li');
        const now = new Date();
        const timestamp = `[${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}]`;
        li.textContent = `${timestamp} ${t(key, ...args)}`;
        li.classList.add(`log-${type}`);
        logList.prepend(li);
        logList.scrollTop = 0;
    }

    resetGameButton.addEventListener('click', () => {
        gameBoard.classList.add('hidden');
        gameSetup.classList.remove('hidden');
        logList.innerHTML = '';
        gameState = {};
        updateUI(); // Re-render setup screen in current language
    });

    // --- Init ---
    playerCountInput.addEventListener('change', renderRoleSelection);
    langZhButton.addEventListener('click', () => setLanguage('zh-CN'));
    langEnButton.addEventListener('click', () => setLanguage('en-US'));

    async function init() {
        const preferredLang = localStorage.getItem('preferredLang');
        const browserLang = navigator.language.startsWith('en') ? 'en-US' : 'zh-CN';
        await setLanguage(preferredLang || browserLang);
    }

    init();
});