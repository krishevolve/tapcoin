const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

class TapCoins {
    constructor() {
        this.headers = {
            "Accept": "application/json, text/plain, */*",
            "Accept-Encoding": "gzip, deflate, br",
            "Accept-Language": "vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5",
            "Content-Type": "application/x-www-form-urlencoded",
            "Origin": "https://game.tapcoins.app",
            "Referer": "https://game.tapcoins.app/",
            "Sec-Ch-Ua": '"Not/A)Brand";v="99", "Google Chrome";v="115", "Chromium";v="115"',
            "Sec-Ch-Ua-Mobile": "?0",
            "Sec-Ch-Ua-Platform": '"Windows"',
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-site",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        };
        this.proxyList = [];
    }

    async loadProxies() {
        try {
            const proxyFile = path.join(__dirname, 'proxy.txt');
            this.proxyList = fs.readFileSync(proxyFile, 'utf8')
                .replace(/\r/g, '')
                .split('\n')
                .filter(Boolean);
            this.log(`Đã tải ${this.proxyList.length} proxy`, 'success');
        } catch (error) {
            this.log('Không thể đọc file proxy.txt', 'error');
            this.proxyList = [];
        }
    }

    getAxiosConfig(index) {
        if (index < this.proxyList.length) {
            const proxyAgent = new HttpsProxyAgent(this.proxyList[index]);
            return { httpsAgent: proxyAgent };
        }
        return {};
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', { 
                httpsAgent: proxyAgent,
                timeout: 10000 
            });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                return 'Unknown';
            }
        } catch (error) {
            return 'Error';
        }
    }

    log(msg, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        switch(type) {
            case 'success':
                console.log(`[${timestamp}] [*] ${msg}`.green);
                break;
            case 'custom':
                console.log(`[${timestamp}] [*] ${msg}`.magenta);
                break;        
            case 'error':
                console.log(`[${timestamp}] [!] ${msg}`.red);
                break;
            case 'warning':
                console.log(`[${timestamp}] [*] ${msg}`.yellow);
                break;
            default:
                console.log(`[${timestamp}] [*] ${msg}`.blue);
        }
    }

    async countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`===== Chờ ${i} giây để tiếp tục vòng lặp =====`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        this.log('', 'info');
    }

    generateRandomPowerDistribution(totalPower) {
        let remaining = totalPower;
        let distribution = [];
        const NUM_TAPS = 10;
        
        for (let i = 0; i < NUM_TAPS - 1; i++) {
            const remainingTaps = NUM_TAPS - i - 1;
            const minPowerNeeded = remainingTaps;
            const maxForThisTap = Math.min(200, remaining - minPowerNeeded);
            
            if (maxForThisTap <= remainingTaps) {
                const evenDistribution = Math.floor(remaining / (NUM_TAPS - i));
                distribution.push(evenDistribution);
                remaining -= evenDistribution;
                continue;
            }
            
            const power = Math.floor(Math.random() * (maxForThisTap - 1)) + 1;
            distribution.push(power);
            remaining -= power;
        }
        
        distribution.push(remaining);
        return distribution;
    }

    async login(initData, axiosConfig) {
        const url = "https://xapi.tapcoins.app/auth/login";
        const payload = `initData=${encodeURIComponent(initData)}&inviteCode=&groupId=`;

        try {
            const response = await axios.post(url, payload, { 
                ...axiosConfig,
                headers: this.headers 
            });
            if (response.status === 200 && response.data.code === 0) {
                const userData = response.data.data.collect.userInfo;
                return { 
                    success: true,
                    data: {
                        token: response.data.data.token,
                        coin: userData.coin,
                        power: userData.power,
                        power_max: userData.power_max,
                        username: userData.username,
                        firstName: userData.firstname,
                        lastName: userData.lastname
                    }
                };
            } else {
                return { success: false, error: response.data.message || 'Unknown error' };
            }
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async collect(token, tapPower, remainingPower, axiosConfig) {
        const url = "https://xapi.tapcoins.app/coin/collect";
        const payload = `coin=${tapPower}&power=${remainingPower}&turbo=0&_token=${token}`;
    
        try {
            const response = await axios.post(url, payload, { 
                ...axiosConfig,
                headers: this.headers 
            });
    
            if (response) {
                const { userInfo } = response.data;
                return {
                    success: true,
                    data: {
                        earnedCoin: tapPower || 0,
                        totalCoin: tapPower,
                        remainingPower: remainingPower
                    }
                };
            } else {
                return {
                    success: false,
                    error: response?.data?.message || 'Invalid response structure'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getTaskList(token, axiosConfig) {
        const url = "https://xapi.tapcoins.app/task/list";
        const payload = `adv=0&_token=${token}`;

        try {
            const response = await axios.post(url, payload, { 
                ...axiosConfig,
                headers: this.headers 
            });
            if (response.status === 200 && response.data.code === 0) {
                return {
                    success: true,
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Unknown error'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async completeTask(token, taskId, axiosConfig) {
        const url = "https://xapi.tapcoins.app/task/complete";
        const payload = `taskId=${taskId}&adv=0&kind=&_token=${token}`;

        try {
            const response = await axios.post(url, payload, { 
                ...axiosConfig,
                headers: this.headers 
            });
            if (response.status === 200 && response.data.code === 0) {
                return {
                    success: true,
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Unknown error'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    async handleTasks(token, axiosConfig) {
        this.log('Đang lấy danh sách nhiệm vụ...', 'info');
        const taskListResult = await this.getTaskList(token, axiosConfig);

        if (taskListResult.success) {
            const incompleteTasks = taskListResult.data.filter(task => 
                task.completed === 0 && 
                ![333, 337, 330, 313, 302, 298, 287, 320, 321, 247, 32, 8].includes(task.id)
            );

            if (incompleteTasks.length === 0) {
                this.log('Không có nhiệm vụ mới!', 'warning');
                return;
            }

            for (const task of incompleteTasks) {
                this.log(`Đang thực hiện nhiệm vụ: ${task.title}`, 'info');
                
                const completeResult = await this.completeTask(token, task.id, axiosConfig);
                
                if (completeResult.success) {
                    this.log(`Làm nhiệm vụ ${task.title} thành công | Phần thưởng : ${task.reward}`, 'success');
                } else {
                    this.log(`Làm nhiệm vụ ${task.title} thất bại: ${completeResult.error}`, 'error');
                }

                const delay = Math.floor(Math.random() * 5000) + 5000;
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        } else {
            this.log(`Không thể lấy danh sách nhiệm vụ: ${taskListResult.error}`, 'error');
        }
    }

    async getMiningTasks(token, categoryId, axiosConfig) {
        const url = "https://xapi.tapcoins.app/mine/task/list";
        const payload = `categoryId=${categoryId}&_token=${token}`;
    
        try {
            const response = await axios.post(url, payload, { 
                ...axiosConfig,
                headers: this.headers 
            });
            if (response.status === 200 && response.data.code === 0) {
                return {
                    success: true,
                    data: response.data.data
                };
            } else {
                return {
                    success: false,
                    error: response.data.message || 'Unknown error'
                };
            }
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    async upgradeMiningTask(token, taskId, axiosConfig) {
        const url = "https://xapi.tapcoins.app/mine/upgrade";
        const requestId = Date.now();
        const payload = `taskId=${taskId}&requestId=${requestId}&_token=${token}`;
    
        try {
            const response = await axios.post(url, payload, { 
                ...axiosConfig,
                headers: this.headers 
            });
            if (response.status === 200) {
                if (response.data.code === 0) {
                    return {
                        success: true,
                        data: response.data.data,
                        currentCoin: response.data.data.coin
                    };
                } else {
                    return {
                        success: false,
                        error: response.data.message,
                        errorCode: response.data.code
                    };
                }
            }
        } catch (error) {
            return {
                success: false,
                error: error.message,
                errorCode: -1
            };
        }
    }
    
    async handleMiningUpgrades(token, initialCoin, axiosConfig) {
        let config;
        try {
            config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
        } catch (error) {
            this.log('Không thể đọc file config.json. Tạo file mới với giá trị mặc định.', 'warning');
            config = {
                max_upgrade_cost: 5000,
                upgrade_delay: 5000
            };
            fs.writeFileSync('config.json', JSON.stringify(config, null, 2));
        }
    
        const maxUpgradeCost = config.max_upgrade_cost;
        const upgradeDelay = config.upgrade_delay || 5000;
        let currentCoin = initialCoin;
    
        this.log(`Số coin hiện tại: ${currentCoin}`, 'info');
        this.log(`Giới hạn chi phí upgrade: ${maxUpgradeCost} coins`, 'info');
    
        let allTasks = [];
        for (let categoryId = 1; categoryId <= 4; categoryId++) {
            this.log(`Đang lấy danh sách mining task category ${categoryId}...`, 'info');
            const result = await this.getMiningTasks(token, categoryId, axiosConfig);
            
            if (result.success) {
                allTasks = allTasks.concat(result.data);
            } else {
                this.log(`Lỗi khi lấy danh sách category ${categoryId}: ${result.error}`, 'error');
            }
            
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    
        allTasks.sort((a, b) => b.initial_earnings - a.initial_earnings);
    
        let consecutiveFailures = 0;
        const MAX_CONSECUTIVE_FAILURES = 3;
    
        for (const task of allTasks) {
            if (!task.upgradable || task.upgrade_cost > Math.min(currentCoin, maxUpgradeCost)) {
                continue;
            }
    
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
                this.log('Đã đạt giới hạn số lần thất bại liên tiếp, tạm dừng upgrade', 'warning');
                break;
            }
    
            this.log(`Đang upgrade task: ${task.name}`, 'info');
            this.log(`Chi phí: ${task.upgrade_cost} | Earnings: ${task.upgrade_earnings}`, 'custom');
            
            const upgradeResult = await this.upgradeMiningTask(token, task.id, axiosConfig);
            
            if (upgradeResult.success) {
                currentCoin = upgradeResult.currentCoin;
                this.log(`Upgrade thành công task ${task.name}!`, 'success');
                consecutiveFailures = 0;
            } else {
                this.log(`Upgrade thất bại task ${task.name}: ${upgradeResult.error}`, 'error');
                consecutiveFailures++;
    
                if (upgradeResult.error.includes('frequent operations')) {
                    this.log(`Phát hiện frequent operations, tăng delay lên ${upgradeDelay * 2}ms`, 'warning');
                    await new Promise(resolve => setTimeout(resolve, upgradeDelay * 2));
                } else if (upgradeResult.error.includes('Insufficient balance')) {
                    this.log('Không đủ coin, dừng upgrade', 'warning');
                    break;
                }
            }
    
            await new Promise(resolve => setTimeout(resolve, upgradeDelay));
        }
    }

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }))
    }

    async main() {
        await this.loadProxies();
        
        const dataFile = path.join(__dirname, 'data.txt');
        const data = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        this.log('Tool được chia sẻ tại kênh telegram Dân Cày Airdrop (@dancayairdrop)'.green);
    
        const nhiemvu = await this.askQuestion('Bạn có muốn làm nhiệm vụ không? (y/n): ');
        const hoinhiemvu = nhiemvu.toLowerCase() === 'y';
        const nangcap = await this.askQuestion('Bạn có muốn nâng cấp không? (y/n): ');
        const hoinangcap = nangcap.toLowerCase() === 'y';
        
        while (true) {
            for (let i = 0; i < data.length; i++) {
                const initData = data[i];
                const axiosConfig = this.getAxiosConfig(i);
                
                let proxyIP = 'No proxy';
                if (i < this.proxyList.length) {
                    proxyIP = await this.checkProxyIP(this.proxyList[i]);
                }
                
                console.log(`========== Tài khoản ${i + 1} | IP: ${proxyIP} ==========`);
                
                const loginResult = await this.login(initData, axiosConfig);
                
                if (loginResult.success) {
                    const { token, coin, power, power_max, username, firstName, lastName } = loginResult.data;
                    this.log('Đăng nhập thành công!', 'success');
                    this.log(`Username: ${username}`, 'custom');
                    this.log(`Tên: ${firstName} ${lastName}`, 'custom');
                    this.log(`Token: ${token}`, 'info');
                    this.log(`Coin: ${coin}`, 'success');
                    this.log(`Power: ${power}/${power_max}`, 'warning');

                    if (power > 0) {
                        this.log(`Phát hiện ${power} power, chia thành 20 lần tap...`, 'info');
                        const powerDistribution = this.generateRandomPowerDistribution(power);
                        let currentPower = power;
                        let totalEarnedCoin = 0;
                        let tapSuccess = true;

                        for (let j = 0; j < powerDistribution.length && tapSuccess; j++) {
                            const tapPower = powerDistribution[j];
                            currentPower -= tapPower;
                            
                            this.log(`Lần tap ${j + 1}: Sử dụng ${tapPower} power (Còn lại: ${currentPower})`, 'info');
                            const collectResult = await this.collect(token, tapPower, currentPower, axiosConfig);
                            
                            if (collectResult.success) {
                                totalEarnedCoin += collectResult.data.earnedCoin;
                                this.log(`Tap thành công! Nhận được ${collectResult.data.earnedCoin} coin`, 'success');
                                this.log(`Power còn lại: ${collectResult.data.remainingPower}`, 'warning');
                                
                                const delay = Math.floor(Math.random() * 2000) + 1000;
                                await new Promise(resolve => setTimeout(resolve, delay));
                            } else {
                                this.log(`Tap thất bại: ${collectResult.error}`, 'error');
                                tapSuccess = false;
                            }
                        }

                        this.log(`Hoàn thành vòng tap! Tổng coin nhận được: ${totalEarnedCoin}`, 'success');
                    }
                    if (hoinhiemvu) {
                        await this.handleTasks(token, axiosConfig);
                    }
                    if (hoinangcap) {
                        await this.handleMiningUpgrades(token, coin, axiosConfig);
                    }
                } else {
                    this.log(`Đăng nhập không thành công: ${loginResult.error}`, 'error');
                }

                const accountDelay = Math.floor(Math.random() * 2000) + 3000;
                await new Promise(resolve => setTimeout(resolve, accountDelay));
            }

            await this.countdown(10 * 60);
        }
    }
}

const client = new TapCoins();
client.main().catch(err => {
    client.log(err.message, 'error');
    process.exit(1);
});