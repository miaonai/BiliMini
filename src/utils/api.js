import axios from "axios";


const handleRequest = async function (url, method = 'get', data = false, options = {}) {
    if (method === 'get') {
        try {
            const response = await axios.get(url, options);
            return response.data;
        }
        catch (e) {
            console.error('api请求: ' + e);
            return false;
        }
    } else if (method === 'post') {
        try {
            const response = await axios.post(url, data, options);
            return response.data;
        }
        catch (e) {
            console.error('api请求: ' + e);
            return false;
        }
    }
}

// 获取动态
const getDynamicData = async function (type, updateBaseline = false, offset = false) {
    console.log('offset: ' + offset)
    let url = `https://api.bilibili.com/x/polymer/web-dynamic/v1/feed/all?type=${type}`;
    if (updateBaseline) {
        url += `&update_baseline=${updateBaseline}`;
    }
    if (offset) {
        url += `&offset=${offset}`;
    }

    const responseData= await handleRequest(url);
    return responseData;
}

// 获取综合热门，与官方热门页使用同一分页接口。
const getPopularData = async function (page = 1, pageSize = 20) {
    return handleRequest(`https://api.bilibili.com/x/web-interface/popular?pn=${page}&ps=${pageSize}`);
}

//获取稍后再看
const getToWatchData = async function () {
    const responseData= await handleRequest('https://api.bilibili.com/x/v2/history/toview');
    return responseData;
}

//添加稍后再看
const addToWatchData = async function (aid, jct) {
    const responseData= await handleRequest('https://api.bilibili.com/x/v2/history/toview/add', 'post', new URLSearchParams({
        'jsonp': 'jsonp',
        'aid': aid,
        'csrf': jct,
    }));
    return responseData;
}

//删除稍后再看
const delTowatchData = async function (aid, jct) {
    const responseData= await handleRequest('https://api.bilibili.com/x/v2/history/toview/del', 'post', new URLSearchParams({
        'jsonp': 'jsonp',
        'aid': aid,
        'csrf': jct,
    }));
    return responseData;
}

//获取直播
const getLiveData = async function (page = 1, pageSize = 10) {
    const responseData= await handleRequest(`https://api.live.bilibili.com/relation/v1/feed/feed_list?page=${page}&pagesize=${pageSize}`)
    return responseData;
}

//获取历史记录
const getHistoryData = async function (cursor = null) {
    const params = new URLSearchParams({ type: 'archive', ps: 20,
        max: cursor?.max || 0, view_at: cursor?.view_at || 0, business: cursor?.business || '',
    });
    const responseData= await handleRequest(`https://api.bilibili.com/x/web-interface/history/cursor?${params}`)
    return responseData;
}

// Snapshot previews use the public videoshot endpoint, also used by Bilibili-Gate.
const getVideoPreviewData = async function (target) {
    const request = url => handleRequest(url, 'get', false, { timeout: 8000 });
    let archive = { ...target };
    if (archive.epid) {
        const season = await request(`https://api.bilibili.com/pgc/view/web/season?ep_id=${archive.epid}`);
        const episode = season?.result?.episodes?.find(item => String(item.id) === archive.epid);
        if (!episode || (!episode.aid && !episode.bvid)) return false;
        archive = { aid: episode.aid, bvid: episode.bvid, cid: episode.cid, duration: episode.duration / 1000 };
    }
    if (!archive.cid) {
        const identity = new URLSearchParams(archive.aid ? { aid: archive.aid } : { bvid: archive.bvid });
        const view = await request(`https://api.bilibili.com/x/web-interface/view?${identity}`);
        const part = view?.data?.pages?.find(item => item.page === (archive.page || 1));
        if (view?.code === 0 && part?.cid) {
            archive.cid = part.cid;
            archive.duration = part.duration;
        } else {
            if (archive.page > 1) return false;
            // The feed's total duration can span multiple parts. Without part
            // metadata, use the snapshot timeline instead of that total.
            archive.duration = undefined;
        }
    }
    const params = new URLSearchParams({ index: '1', ...(archive.aid ? { aid: archive.aid } : { bvid: archive.bvid }) });
    if (archive.cid) params.set('cid', archive.cid);
    const response = await request(`https://api.bilibili.com/x/player/videoshot?${params}`);
    return response && { ...response, duration: archive.duration };
}

export {
    getDynamicData,
    getPopularData,
    getToWatchData,
    addToWatchData,
    delTowatchData,
    getLiveData,
    getHistoryData,
    getVideoPreviewData,
}
