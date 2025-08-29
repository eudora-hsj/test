const mapConfig = {
    accessToken: 'pk.eyJ1IjoiZXVkb3JhZjJlIiwiYSI6ImNsa2lqNzgxcjBpZngzZm9hdG9jbHE2ZzUifQ.kiEOscst8hVf_N8psAW5tg',
    style: 'mapbox://styles/baseddesign/ckzqqk061002u15n71253c5bc',
     //style: 'mapbox://styles/eudoraf2e/cmdimb31e03nu01r46cq12ouk',
}

const state = {
    // fetch data:
    dataSections: [], // 北台灣/宜蘭
    dataLocations: [], //所有莊園
    // elements
    locationsEl: null,
    locationEls: null,
    stepsEl: null,
    // cal data
    stepData: [],
    locationsObj: {},
    curSectionId: null,
    markers: {},
    isMobile: false,
    // 使用者互動鎖定：避免 ScrollTrigger 在邊界把手動選擇覆寫掉
    userHoldUntil: 0,
    userSelectedLocationId: null,
    // 目前觸發中的離散步驟索引
    activeStepIndex: -1,
    // 上一幀捲動進度，用於判斷方向與邊界遲滯
    lastProgress: 0,
    // 阻止 snap 觸發的時間戳
    preventSnapUntil: 0

}

const isMobileDevice = () => {
    return window.innerWidth <= 768
}
const mapControl = {
    initMapPosition: {
        center: [121.5, 24.9],
        zoom: 9,
        pitch: 0,
        bearing: 0,
        offset: [0, 0]
    },
    userEnableRule: {
        scrollZoom: false,      // 禁用滾輪縮放
        dragPan: false,         // 禁用拖曳平移
        dragRotate: false,      // 禁用拖曳旋轉
        doubleClickZoom: false, // 禁用雙擊縮放
        touchZoomRotate: false, // 禁用觸控縮放與旋轉
    },
    popupAttr:{
        offset: 25,
        closeButton: false,  // 是否顯示關閉按鈕
        closeOnClick: false, // 點擊地圖時是否關閉 Popup
        anchor: 'bottom'     // Popup 固定在 Marker 的上方
    },
    closePinsPopup: () => {
        Object.values(state.markers).forEach(marker => {
            if (marker.getPopup().isOpen()) marker.togglePopup()
        })
    },
    openPinPopup: (locationId) => {
        const marker = state.markers[locationId]
        if (marker) {
            mapControl.closePinsPopup()
            marker.togglePopup()
        }
    },

    // 連續插值更新地圖狀態：支援 init → 第一步的過渡
    updateMapByProgress: (progress, stepData) => {
        const totalSteps = stepData.length
        if (totalSteps === 0) return

        // totalStates = steps + init
        const totalStates = totalSteps + 1
        const stepSize = 1 / (totalStates - 1) // = 1 / totalSteps

        // 找出目前所在的狀態區段（包含 init）
        const seg = Math.min(Math.floor(progress / stepSize), totalStates - 2) // 0..totalSteps-1
        const localT = Math.min(Math.max((progress - seg * stepSize) / stepSize, 0), 1)

        // 對應到步驟索引：current = seg-1 (-1 表 init), next = current+1
        const currentIdx = seg - 1
        const nextIdx = Math.min(currentIdx + 1, totalSteps - 1)

        // 取得目標狀態
        const currentTarget = currentIdx < 0
          ? { ...mapControl.initMapPosition }
          : scrollTriggerEvents.getMapTarget(stepData[currentIdx])
        // 可能遇到沒有目標（如 location-extended），用當前目標回退避免跳動
        const nextTarget = scrollTriggerEvents.getMapTarget(stepData[nextIdx]) || currentTarget

        if (!currentTarget || !nextTarget) return

        // 簡單線性插值
        const lerp = (a, b, t) => a + (b - a) * t
        const lerpArr2 = (a, b, t) => [
            lerp(a[0], b[0], t),
            lerp(a[1], b[1], t)
        ]

        const center = lerpArr2(currentTarget.center, nextTarget.center, localT)
        const zoom = lerp(
          currentTarget.zoom ?? map.getZoom(),
          nextTarget.zoom ?? map.getZoom(),
          localT
        )
        const offset = lerpArr2(
          currentTarget.offset || [0, 0],
          nextTarget.offset || [0, 0],
          localT
        )

        const offsetCenter = scrollTriggerEvents.calculateOffsetCenter(center, offset, zoom)
        // 直接設置相機以追隨捲動
        map.setCenter(offsetCenter)
        map.setZoom(zoom)
    },
    // resetPinPopupState: () => {
    //
    // },
    //
    // resetMapDivScrollPosition: () => {
    //     const isScrolledToBottom = state.locationsEl.scrollHeight - state.locationsEl.clientHeight <= state.locationsEl.scrollTop + 1
    //     if (!isScrolledToBottom) {
    //         state.locationsEl.scrollIntoView({
    //             top: state.locationsEl.scrollHeight,
    //             behavior: 'smooth'
    //         })
    //     }
    //
    // },
}

const scrollControl = {
    toLocationCard: (location) => {
        const isMobile = isMobileDevice()
        if (isMobile) return
        gsap.to(state.locationsEl, {
            //duration: 0.8,
            scrollTo: {y: location, offsetY: 100},
            //ease: "power2.inOut"
        })
    }
}

const domControlEvents = {
    renderLocationCards: () => {
        if (!state.locationsEl) return
        // Clear existing content
        state.locationsEl.innerHTML = null

        // Create and append location elements
        state.dataLocations.forEach(location => {
            const locationEl = document.createElement('div')
            locationEl.className = 'map-location'
            locationEl.id = `location-${location.id}`
            locationEl.setAttribute('data-section', location.sectionId)
            locationEl.innerHTML = `
                <h3>${location.title}</h3>
                <p>${location.description}</p>
            `

            locationEl.addEventListener('click', () => {
                onClickEvents.locationCard(location)
            })

            state.locationsEl.appendChild(locationEl)
        })
        state.locationEls = document.querySelectorAll('.map-location')
        state.locationsEl.classList.add('invisible')
    },
    loadPins: async () => {
        try {
            state.dataLocations.forEach(location => {
                const el = document.createElement('div')
                el.className = 'marker'
                const inner = document.createElement('div')
                inner.className = 'marker-inner'
                el.appendChild(inner)
                
                const popup = new mapboxgl.Popup(mapControl.popupAttr)
                    .setHTML(`
                        <h3>${location.title}</h3>
                    `)

                const marker = new mapboxgl.Marker(el)
                    .setLngLat(location.position)
                    .setPopup(popup)
                    .addTo(map)

                state.markers[location.id] = marker

                el.addEventListener('click', (e) => {
                    onClickEvents.marker(e, location.id)
                }, { capture: true })
                popup.on('open', () => {
                    el.classList.add('active');
                });
                popup.on('close', () => {
                    el.classList.remove('active');
                });
            })
        } catch (error) {
            console.error(error)
        }
    },
}

const uiControlEvents = {
    toggleDisplayLocationCardList: (isShow) => {
        if (!state.locationsEl) return

        if (isShow) {
            state.locationsEl.classList.remove("invisible")
            state.locationsEl.style.opacity = "1"
        } else {
            state.locationsEl.classList.add("invisible")
            state.locationsEl.style.opacity = "0"
            mapControl.closePinsPopup()
        }
    },
    toggleDisplayLocationCard: (sectionId, activeLocationId = null) => {
        uiControlEvents.toggleDisplayLocationCardList(true)
        const isMobile = isMobileDevice()
        state.locationEls.forEach(el => {
            el.classList.remove('active')
            const elLocationId = el.id.replace('location-', '')

            if (isMobile) {
                Number(elLocationId) === activeLocationId ?  el.classList.remove('hidden') : el.classList.add('hidden')
            }

        })
    },
    activeLocationCard: (locationId) => {
        const selectedLocation = document.getElementById(`location-${locationId}`)
        if (selectedLocation && state.locationsEl) {
            state.locationEls.forEach(el => el.classList.remove('active'))
            selectedLocation.classList.add('active')
            scrollControl.toLocationCard(selectedLocation)
        }
    },
}

const onClickEvents = {
    marker: (e, locationId) => {
        e.preventDefault()
        e.stopPropagation()
        if (!state.curSectionId) return
        // 阻止吸附功能
        state.preventSnapUntil = Date.now() + 1000
        
        mapControl.closePinsPopup()
        mapControl.openPinPopup(locationId)
        uiControlEvents.activeLocationCard(locationId)
    },
    locationCard: (location) => {
        location.href && window.open(location.href, '_blank')
    },
}

const scrollTriggerEvents = {
    init: () => {
        const stepData = state.stepData
        const stepsEl = state.stepsEl
        stepData.forEach(() => {
            const step = document.createElement("div")
            step.className = "step"
            step.style.height = `100vh`  /* 每個步驟佔滿一整個螢幕的滾動距離 */
            stepsEl.appendChild(step)
        })

        // 2. 建立主時間軸，控制 steps-container 的 Y 軸移動，模擬內部滾動
        const contentTimeline = gsap.timeline({
            defaults: {ease: "power2.inOut"} 
        })
        contentTimeline.to("#steps-container", {
            yPercent: -100 * (stepData.length - 1),
            ease: "power2.inOut"
        })

        // 3. 建立主 ScrollTrigger，釘選 #panel3 並將外部滾動與時間軸同步
        ScrollTrigger.create({
            id: "main-scroll",
            trigger: "#panel-map",
            start: "top top",
            end: `+=${100 * stepData.length}%`, // 每個步驟分配 100% 視窗高度的滾動距離
            pin: true,
            scrub: 1.5, // 增加scrub值使滾動更平滑
            pinSpacing: true, // 啟用pin間距
            animation: contentTimeline,
            anticipatePin: 1,
            // 使用 ScrollTrigger 內建的 snap 功能實現吸附效果
            snap: {
                snapTo: (progress) => {
                    // 檢查是否在阻止 snap 的時間內
                    if (Date.now() < state.preventSnapUntil) {
                        return progress // 返回當前進度，不進行 snap
                    }
                    
                    // 計算最接近的步驟節點（包含 init 狀態）
                    const totalSteps = stepData.length
                    const totalStates = totalSteps + 1 // steps + init
                    const stepSize = 1 / (totalStates - 1)
                    
                    // 找到最接近的節點
                    const nearestIndex = Math.round(progress / stepSize)
                    return Math.min(Math.max(nearestIndex * stepSize, 0), 1)
                },
                duration: {min: 0.1, max: 0.2}, // 吸附動畫持續時間範圍
                delay: 100, // 停止滾動後的延遲時間
                ease: "none" // 吸附動畫的緩動函數
            },
            onUpdate: (self) => {
                // 1) 連續插值：地圖隨捲動平滑移動
                const progress = self.progress
                const total = stepData.length
                if (total === 0) return
                mapControl.updateMapByProgress(progress, stepData)

                // 2) 離散 UI：只在跨越中點時更新側欄與彈窗，不移動地圖
                const index = scrollTriggerEvents.getDiscreteIndex(progress, total, state.activeStepIndex, state.lastProgress)
                if (index !== state.activeStepIndex) {
                    state.activeStepIndex = index
                    if (index === -1) {
                        scrollTriggerEvents.toInit()
                    } else {
                        const step = stepData[index]
                        if (step) scrollTriggerEvents.updateSidebar(step)
                    }
                }

                // 3) 記錄上一幀進度
                state.lastProgress = progress
            }
        })

    },
    // 計算離散步驟索引，具備邊界遲滯避免抖動
    getDiscreteIndex: (progress, total, prevIndex, lastProgress) => {
        // 單一步驟直接返回 0
        if (total <= 1) return 0

        // 每步的等分寬度
        const stepSpan = 1 / (total - 1)

        // 遲滯帶寬度（百分比），可依體感微調
        const hysteresis = 0.06 * stepSpan

        // 判斷捲動方向
        const forward = progress - lastProgress >= 0

        // 兩種方向的邊界函式
        const boundaryUp = i => (i + 0.5) * stepSpan
        const boundaryDown = i => (i - 0.5) * stepSpan

        // init 與 step0 之間的判斷
        if (prevIndex < 0) {
            const b0 = 0.5 * stepSpan
            if (forward) return progress > b0 + hysteresis ? 0 : -1
            return progress < b0 - hysteresis ? -1 : 0
        }

        // 前進：跨越 i→i+1 的邊界
        if (forward) {
            const b = boundaryUp(prevIndex)
            if (progress > b + hysteresis) return Math.min(prevIndex + 1, total - 1)
            return prevIndex
        }

        // 後退：跨越 i→i-1 的邊界
        if (prevIndex === 0) {
            const b0 = 0.5 * stepSpan
            if (progress < b0 - hysteresis) return -1
            return 0
        }
        const b = boundaryDown(prevIndex)
        if (progress < b - hysteresis) return Math.max(prevIndex - 1, -1)
        return prevIndex
    },

    //// 封裝地圖移動，套用 offset 轉換
    //moveMapToTarget: (target) => {
    //    const offsetCenter = scrollTriggerEvents.calculateOffsetCenter(
    //        target.center,
    //        target.offset || [0, 0],
    //        target.zoom || map.getZoom()
    //    )
    //    map.easeTo({
    //        center: offsetCenter,
    //        zoom: target.zoom,
    //        duration: 500,
    //        easing: t => t
    //    })
    //},
    calculateOffsetCenter: (center, offset, zoom) => {
        // 將像素偏移轉換為經緯度偏移
        // 這是一個簡化的計算，基於 Web Mercator 投影
        const metersPerPixel = 156543.03392 * Math.cos(center[1] * Math.PI / 180) / Math.pow(2, zoom)
        const offsetLng = offset[0] * metersPerPixel / 111320 // 1 度經度約等於 111320 米
        const offsetLat = offset[1] * metersPerPixel / 110540 // 1 度緯度約等於 110540 米
        
        return [
            center[0] + offsetLng,
            center[1] + offsetLat
        ]
    },
    updateSidebar: (step) => {
        // 根據步驟類型更新側邊欄
        if (step.type === 'init') {
            // 初始狀態：隱藏所有側邊欄內容
            uiControlEvents.toggleDisplayLocationCardList(false)
            mapControl.closePinsPopup()
            state.curSectionId = null
        } else if (step.type === 'section') {
            // section 步驟時：如果之前有顯示的 section 卡片，需要關閉
            if (state.curSectionId) {
                uiControlEvents.toggleDisplayLocationCardList(false)
                mapControl.closePinsPopup()
                state.curSectionId = null
            }
        } else if (step.type === 'location') {
            // 先確保該地點所屬區域的卡片已顯示
            if (!state.curSectionId || state.curSectionId !== step.data.sectionId) {
                state.curSectionId = step.data.sectionId
                // 傳遞當前地點 ID 給 toggleDisplayLocationCard
                uiControlEvents.toggleDisplayLocationCard(step.data.sectionId, step.data.id)
            } else {
                // 如果已經是同一個區域，只需要更新顯示的卡片（手機版）
                const isMobile = isMobileDevice()
                if (isMobile) {
                    uiControlEvents.toggleDisplayLocationCard(step.data.sectionId, step.data.id)
                }
            }
            
            // 高亮當前地點卡片
            uiControlEvents.activeLocationCard(step.data.id)
            // 顯示地圖標記彈窗
            mapControl.openPinPopup(step.data.id)
        }
    },
    getMapTarget: (step) => {
        // 根據步驟類型返回目標地圖狀態
        if (step.type === 'init') {
            // 初始狀態
            return {
                ...mapControl.initMapPosition,
                //offset: [0, 0]
            }
        } else if (step.type === 'section') {
            const locations = state.locationsObj[step.data.id]
            if (locations && locations.length > 0) {
                // 計算區域的中心點和適當的縮放級別
                const bounds = new mapboxgl.LngLatBounds()
                locations.forEach(location => bounds.extend(location.position))
                const center = bounds.getCenter()
                const isMobile = isMobileDevice()
                return {
                    center: [center.lng, center.lat],
                    zoom: 10,
                    offset: isMobile ? [0, 120] : [0, 0] // 手機版向下偏移，PC版不偏移
                }
            }
        } else if (step.type === 'location') {
            const isMobile = isMobileDevice()
            return {
                center: step.data.position,
                zoom: 11.5, // 輕微 zoom in
                offset: isMobile ? [0, 120] : [150, 0] // 手機版向下偏移，PC版向左偏移
            }
        }

        //// 預設返回初始狀態，稍微 zoom out
        //return {
        //    center: mapControl.initMapPosition.center,
        //    zoom: mapControl.initMapPosition.zoom + 1,
        //    offset: [0, 0]
        //}
    },
    toInit: () => {
        uiControlEvents.toggleDisplayLocationCardList(false)
        mapControl.closePinsPopup()
        state.curSectionId = null
    },
    //isLastLocationStep: (currentStep) => {
    //    if (currentStep.type !== 'location') return false
    //    
    //    // 找到當前 section 的所有 location 步驟
    //    const currentSectionId = currentStep.data.sectionId
    //    const currentSectionLocations = state.stepData.filter(step => 
    //        step.type === 'location' && step.data.sectionId === currentSectionId
    //    )
    //    
    //    if (currentSectionLocations.length === 0) return false
    //    
    //    // 檢查當前步驟是否是該 section 的最後一個 location
    //    const lastLocationInSection = currentSectionLocations[currentSectionLocations.length - 1]
    //    return currentStep.data.id === lastLocationInSection.data.id
    //},
    //// 使用者手動點擊鎖定側邊欄一段時間，避免邊界抖動覆寫
    //holdSidebarByUser: (locationId, ms = 1500) => {
    //    return
    //    state.userHoldUntil = Date.now() + ms
    //    state.userSelectedLocationId = locationId
    //},
    //// 依據 locationId 捲動到對應的步驟中心
    //scrollToLocationStep: (locationId) => {
    //    const st = ScrollTrigger.getById('main-scroll')
    //    if (!st || !Array.isArray(state.stepData) || state.stepData.length === 0) return
    //
    //    // 找出第一個匹配的 location 步驟索引
    //    const targetIndex = state.stepData.findIndex(step => step.type === 'location' && step.data && step.data.id === locationId)
    //    if (targetIndex < 0) return
    //
    //    // 主滾動區間起迄（像素）
    //    const start = st.start
    //    const end = st.end
    //
    //    // 每個步驟對應 1 個視窗高度的滾動距離
    //    const vh = window.innerHeight
    //    let targetY = start + (targetIndex + 0.5) * vh
    //
    //    // 保險：限制在可滾動範圍內
    //    targetY = Math.max(start, Math.min(targetY, end))
    //
    //    // 平滑捲動到對應步驟中心
    //    gsap.to(window, {
    //        scrollTo: targetY,
    //        duration: 0.6,
    //        ease: 'power2.inOut'
    //    })
    //}
}

const fetchData = async () => {
    try {
        const response = await fetch('data.json')
        const data = await response.json()
        state.dataSections = data.sections
        state.dataLocations = data.locations
    } catch (error) {
        console.error('Error fetching data:', error)
    }
}

const setInitData = () => {
    state.dataSections.forEach(section => {
        state.locationsObj[section.id] = state.dataLocations.filter(location => location.sectionId === section.id)

    })
    const stepData = []
    state.dataSections.forEach(section => {
        stepData.push({
            type: 'section',
            data: section
        })
        state.locationsObj[section.id].forEach(location => {
            stepData.push({
                type: 'location',
                data: location
            })
        })
    })

    const lastLocation = stepData[stepData.length - 1];
    if (lastLocation && lastLocation.type === 'location') {
        stepData.push({
            type: 'location-extended',
            data: lastLocation.data,
            callback: () => {
                //scrollTriggerEvents.toLocation(lastLocation.data)
            }
        })
    }

    state.stepData = stepData

    domControlEvents.renderLocationCards()
}


gsap.registerPlugin(ScrollTrigger, ScrollToPlugin)

document.addEventListener('DOMContentLoaded', async () => {
    await fetchData()

    state.locationsEl = document.getElementById('map-locations')
    state.stepsEl = document.getElementById("steps-container")

    setInitData()
    scrollTriggerEvents.init()
})

// map-setup
mapboxgl.accessToken = mapConfig.accessToken
const map = new mapboxgl.Map({
    container: 'map',
    style: mapConfig.style,
    ...mapControl.initMapPosition,
    ...mapControl.userEnableRule
})
map.scrollZoom.disable()

map.on('load', async () => {
    await domControlEvents.loadPins()
})
map.on('style.load', () => {
    map.setFog({})
})