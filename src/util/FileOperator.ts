/**
 * Description:
 * Author: SiFan Wei - weisifan
 * Date: 2020-05-23 11:48
 */
import * as fs from 'fs';
import * as path from 'path';


export function createNewFile(filePath: string) {
    openWriteStream(filePath).close();
}

export function openReadStream(filePath: string): fs.ReadStream {
    return fs.createReadStream(filePath);
}

export function openWriteStream(filePath: string): fs.WriteStream {
    return fs.createWriteStream(filePath);
}



// 递归创建目录 异步方法
export async function mkdirsIfNonExistsAsync(dirPath: string): Promise<boolean> {
    if (await existsAsync(dirPath, true)) {
        return true;
    }
    if (await mkdirsIfNonExistsAsync(path.dirname(dirPath))) {
        return new Promise<boolean>((resolve, reject) => {
            fs.mkdir(dirPath, async (err: NodeJS.ErrnoException) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(true);
                }
            });
        });
    }
    return false;
}

/**
 * 是否存在指定文件
 * @param filePath 要判断的文件绝对路径
 * @param isDirectory 是否期望为目录
 */
export async function existsAsync(filePath: string, isDirectory?: boolean): Promise<boolean> {
    const exists = await new Promise<boolean>((resolve, reject) => {
        fs.exists(filePath, resolve);
    });
    if (!exists) {
        return false;
    }
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stat) => {
            if (err) {
                reject(err);
            } else {
                if (isDirectory) {
                    resolve(stat.isDirectory());
                } else {
                    resolve(stat.isFile());
                }
            }
        });
    });
}


export function deleteFileOrDirAsync(fileOrDirPath: string): Promise<any> {
    // 如果当前文件不存在，则退出
    if (!fs.existsSync(fileOrDirPath)) {
        return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
        fs.stat(fileOrDirPath, (err, stat) => {
            if (stat.isDirectory()) {
                deleteDirectory(fileOrDirPath).then(resolve).catch(reject);
            } else {
                const parsed = path.parse(fileOrDirPath);
                const filename = parsed.name + (parsed.ext ? parsed.ext : '');
                const dir = parsed.dir ? parsed.dir : '';
                deleteFile(dir, filename).then(resolve).catch(reject);
            }
        });
    });
}

export function deleteDirectory(dirPath: string) {
    return new Promise((resolve, reject) => {
        fs.access(dirPath, (err1) => {
            if (err1) {
                reject(err1);
            }
            fs.readdir(dirPath, (err2, files) => {
                if (err2) {
                    reject(err2);
                }
                Promise.all(files.map((file) => {
                    return deleteFile(dirPath, file)
                })).then(() => {
                    fs.rmdir(dirPath, (err3) => {
                        if (err3) {
                            reject(err3)
                        }
                        resolve();
                    })
                }).catch(reject)
            })
        })
    })
}

export function deleteFile(dirPath: string, file: string) {
    return new Promise((resolve, reject) => {
        let filePath = path.join(dirPath, file);
        fs.stat(filePath, (err1, stats) => {
            if (err1) {
                reject(err1);
            }
            if (stats.isFile()) {
                fs.unlink(filePath, (err2) => {
                    if (err2) {
                        reject(err2);
                    }
                    resolve();
                })
            } else {
                //返回deleteDirectory在all中递归调用
                resolve(deleteDirectory(filePath));
            }
        })
    })
}

/**
 * 异步读文件
 * @param filePath
 * @param options typeof fs.WriteFileOptions
 */
export async function readFileAsync(filePath: string, options?: any): Promise<string> {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, options, (err, data: string) => {
            if (err) {
                reject(err);
            } else {
                resolve(data);
            }
        });
    });
}

/**
 * 异步写内容到文件
 * @param filePath
 * @param text
 * @param options typeof fs.WriteFileOptions
 */
export async function writeFileAsync(filePath: string, text: string, options?: any) {
    return new Promise((resolve, reject) => {
        fs.writeFile(filePath, text, options, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}


export async function appendFile(filePath: string, data: any,) {
    return new Promise((resolve, reject) => {
        fs.appendFile(filePath, data, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

export async function fileLengthAsync(filePath: string): Promise<number> {
    return new Promise((resolve, reject) => {
        fs.stat(filePath, (err, stat) => {
            if (err) {
                reject(err);
            } else {
                resolve(stat.size);
            }
        });
    });
}


/**
 * 拼接字符串数组为路径
 * @param paths
 */
export function pathJoin(...paths: string[]) {
    let p = '';
    if (paths) {
        paths.map((s) => p = path.join(p, s));
    }
    return p;
}


export async function listSubFilesAsync(dirPath: string): Promise<string[]> {
    return await new Promise((resolve, reject) => {
        fs.readdir(dirPath, null, (readErr: NodeJS.ErrnoException | null, children: string[]) => {
            if (readErr) {
                reject(readErr);
                return;
            }
            return children.sort((childA, childB) => {
                return childA.localeCompare(childB);
            });
        });
    });
}