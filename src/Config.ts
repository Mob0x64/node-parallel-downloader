/**
 * Description:
 * Author: SiFan Wei - weisifan
 * Date: 2020-05-18 17:37
 */

import * as crypto from 'crypto';
import {EventEmitter} from 'events';
import Logger from "./util/Logger";

export const Config = {
    INFO_FILE_EXTENSION: '.info.json',
    BLOCK_FILENAME_EXTENSION: '.tmp',
};


export enum DownloadStatus {
    STOP = 'STOP',
    INIT = 'INIT',
    FINISHED = 'FINISHED',
    DOWNLOADING = 'DOWNLOADING',
    CANCEL = 'CANCEL',
    ERROR = 'ERROR',
}


export enum DownloadEvent {
    ERROR = 'ERROR',
    STARTED = 'STARTED',
    STOP = 'STOP',
    FINISHED = 'FINISHED',
    CANCELED = 'CANCELED',
    PROGRESS = 'PROGRESS',
}


export class ErrorMessage {
    private code: string;
    private message: string;

    constructor(code: string, message: string) {
        this.code = code;
        this.message = message;
    }

    public static fromCustomer(code: string, message: string) {
        return new ErrorMessage(code, message);
    }

    public static fromErrorEnum(errEnum: DownloadErrorEnum) {
        const str = errEnum.toString();
        const strs = str.split('@');
        return new ErrorMessage(strs[0], strs[1]);
    }
}

export enum DownloadErrorEnum {
    REQUEST_TIMEOUT = '1000@request timeout',
    UNKNOWN_PROTOCOL = '1001@unknown protocol',
    SERVER_UNAVAILABLE = '1002@server unavailable',
    CREATE_DOWNLOAD_DIR_FAILED = '1003@下载目录创建失败',
    READ_CHUNK_FILE_ERROR = '1004@读取块文件出错',
    WRITE_CHUNK_FILE_ERROR = '1005@写入块文件出错',
    APPEND_TARGET_FILE_ERROR = '1006@追加目标文件出错',
}



declare type TaskIdGenerator = (downloadUrl: string, storageDir: string, filename: string) => Promise<string>;

declare type FileInformationDescriptor = (descriptor: FileDescriptor) => Promise<FileDescriptor>;

export {
    TaskIdGenerator, FileInformationDescriptor
}


export interface FileDescriptor {
    taskId: string;
    configDir: string;
    downloadUrl: string;
    storageDir: string;
    filename: string;
    chunks: number;
    contentType: string;
    contentLength: number;
    md5: string;
    createTime: Date;
    computed?: {
        chunksInfo: ChunkInfo[];
    }
}

export interface ChunkInfo {
    index: number;
    length: number;
    from: number;
    to: number;
}


const defaultFileInformationDescriptor: FileInformationDescriptor = async (descriptor: FileDescriptor) => {
    descriptor.contentType = 'application/zip';
    descriptor.contentLength = 855400185;
    const md5 = crypto.createHash('md5');
    descriptor.md5 = md5.update(descriptor.downloadUrl).digest('hex');
    return descriptor;
};


const defaultTaskIdGenerator: TaskIdGenerator = async (downloadUrl: string, storageDir: string, filename: string) => {
    return crypto.createHash('md5').update(downloadUrl).digest('hex');
};

export {
    defaultFileInformationDescriptor, defaultTaskIdGenerator
}

export class DownloadStatusHolder extends EventEmitter {
    private status!: DownloadStatus;

    protected setStatus(nextStatus: DownloadStatus) {
        this.status = nextStatus;
        return true;
    }

    public getStatus() {
        return this.status;
    }


    /**
     * CAS: 保证状态不被重复设置, 返回的boolean值用来保证各种事件只发送一次, 并且状态转换逻辑只执行一次
     *
     * false: 代表要更新的状态和之前的状态一样, 表明重复多余设置
     * true:  可以用来控制ERROR等回调只执行一次, 因为下载write操作很频繁, 不加控制会回调上百次
     *
     * @param nextStatus 要设置的状态
     * @param reentrant 是否可重入, 默认不可重入
     */
    public compareAndSwapStatus(nextStatus: DownloadStatus, reentrant?: boolean): boolean {
        const prevStatus = this.getStatus();
        // 第一次判断: 前后状态是否一样, 一样就直接返回false表示状态不可重复设置
        if (prevStatus === nextStatus) {
            return !!reentrant;
        }
        if (!prevStatus) {
            if (nextStatus === DownloadStatus.INIT) {
                // 状态未设置的时候, 只可以转变为DownloadStatus.INIT, 其余状态全部拒绝
                return this.setStatus(nextStatus);
            }
            return false;
        }
        // 第二次判断: 部分状态之间不可以相互转换, 下面做判断
        if (nextStatus === DownloadStatus.INIT) {
            // 任何状态都不能转为DownloadStatus.INIT
            return false;
        } else if (nextStatus === DownloadStatus.DOWNLOADING) {
            if (prevStatus === DownloadStatus.FINISHED ||
                prevStatus === DownloadStatus.CANCEL) {
                return false;
            }
        } else if (nextStatus === DownloadStatus.STOP) {
            if (prevStatus === DownloadStatus.INIT ||
                prevStatus === DownloadStatus.FINISHED ||
                prevStatus === DownloadStatus.CANCEL ||
                prevStatus === DownloadStatus.ERROR) {
                return false;
            }
        } else if (nextStatus === DownloadStatus.FINISHED) {
            if (prevStatus === DownloadStatus.ERROR ||
                prevStatus === DownloadStatus.CANCEL) {
                return false;
            }
        } else if (nextStatus === DownloadStatus.CANCEL) {
            // 任何状态都可以转为DownloadStatus.CANCEL
        } else if (nextStatus === DownloadStatus.ERROR) {
            if (prevStatus === DownloadStatus.FINISHED ||
                prevStatus === DownloadStatus.CANCEL) {
                return false;
            }
        } else {
            // 未知的状态, 不设置
            return false;
        }
        return this.setStatus(nextStatus);
    }
}
