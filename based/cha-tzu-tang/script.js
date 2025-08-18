const mapConfig = {
    accessToken: 'pk.eyJ1IjoiZXVkb3JhZjJlIiwiYSI6ImNsa2lqNzgxcjBpZngzZm9hdG9jbHE2ZzUifQ.kiEOscst8hVf_N8psAW5tg',
    style: 'mapbox://styles/baseddesign/ckzqqk061002u15n71253c5bc',
    // style: 'mapbox://styles/eudoraf2e/cmdimb31e03nu01r46cq12ouk',
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
    markers: {}

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
                mapControl.onClickLocationCard(location)
            })

            state.locationsEl.appendChild(locationEl)
        })
        state.locationEls = document.querySelectorAll('.map-location')
        state.locationsEl.classList.add('invisible')
    },
    toggleDisplayLocationCardList: (isShow) => {
        isShow ? state.locationsEl.classList.remove("invisible") : state.locationsEl.classList.add("invisible")
    },
    toggleDisplayLocationCards: (sectionId) => {
        if (!sectionId) {
            domControlEvents.toggleDisplayLocationCardList(false)
        } else {
            domControlEvents.toggleDisplayLocationCardList(true)

            state.locationEls.forEach(el => {
                el.classList.remove('active')
                if (el.getAttribute('data-section') == sectionId) {
                    el.classList.remove('hidden')
                } else {
                    el.classList.add('hidden')
                }
            })

        }

    },
    loadPins: async () => {
        try {
            state.dataLocations.forEach(location => {
                const el = document.createElement('div')
                el.className = 'marker'
                const inner = document.createElement('div')
                inner.className = 'marker-inner'
                el.appendChild(inner)

                const popup = new mapboxgl.Popup({offset: 25})
                    .setHTML(`
                    <h3>${location.title}</h3>
                `)

                const marker = new mapboxgl.Marker(el)
                    .setLngLat(location.position)
                    .setPopup(popup)
                    .addTo(map)

                state.markers[location.id] = marker

                // el.addEventListener('click', () => handleEvent.onClickMarker(location))
                popup.on('open', () => {
                    const popupElement = popup.getElement();
                    popupElement.classList.add('popup-zoomed');
                    // 為對應的 marker 添加 active class
                    el.classList.add('active');
                });
                
                popup.on('close', () => {
                    // 移除 marker 的 active class
                    el.classList.remove('active');
                });
            })
        } catch (error) {
            console.error(error)
        }
    },
    closePinsPopup: () => {
        Object.values(state.markers).forEach(m => {
            if (m.getPopup().isOpen()) m.togglePopup()
        })
    },
    openPinPopup: (locationId) => {
        const marker = state.markers[locationId]
        if (marker) {
            domControlEvents.closePinsPopup()
            marker.togglePopup()
        }
    },
    activeLocationCard: (locationId) => {
        const selectedLocation = document.getElementById(`location-${locationId}`)
        if (selectedLocation && state.locationsEl) {
            state.locationEls.forEach(el => el.classList.remove('active'))
            selectedLocation.classList.add('active')
            gsap.to(state.locationsEl, {
                duration: 0.8,
                scrollTo: {y: selectedLocation, offsetY: 70},
                ease: "power2.inOut"
            })
        }
    },
}

const mapControl = {
    initMapPosition: {
        center: [121.5, 24.9],
        zoom: 9,
        pitch: 0,
        bearing: 0,
    },
    onClickLocationCard: (location) => {
        location.href && window.open(location.href, '_blank')
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
            snap: {
                snapTo: 1 / (stepData.length - 1), // 使滾動可以停在每個step
                duration: {min: 0.3, max: 1}, // 動畫持續時間範圍
                ease: "power2.inOut" // 使用平滑的緩動函數
            },
            animation: contentTimeline,
            anticipatePin: 1,
            onUpdate: (self) => {
                // 邊捲動邊平滑移動地圖，帶有幀間停頓，包含初始狀態
                const scrollProgress = self.progress
                const totalSteps = stepData.length
                
                if (totalSteps === 0) return
                
                // 定義每個步驟的停頓比例
                const pauseRatio = 0.4
                const transitionRatio = 1 - pauseRatio
                
                // 計算考慮停頓的步驟進度，包含初始狀態作為第 0 步
                const adjustedProgress = scrollTriggerEvents.calculateStepProgressWithInit(scrollProgress, totalSteps, pauseRatio, transitionRatio)
                
                //console.log(`捲動進度: ${Math.round(scrollProgress * 100)}%, 調整後進度: ${adjustedProgress.currentIndex}-${adjustedProgress.nextIndex}, 插值: ${adjustedProgress.lerpFactor.toFixed(2)}`)
                
                // 處理側邊欄顯示邏輯
                scrollTriggerEvents.handleSidebarVisibility(adjustedProgress, stepData)
                
                // 處理從初始狀態到第一步驟的過渡
                if (adjustedProgress.currentIndex === -1) {
                    // 從初始狀態過渡到第一個步驟
                    const initState = { type: 'init' }
                    const firstStep = stepData[0]
                    if (firstStep) {
                        scrollTriggerEvents.interpolateMapPosition(initState, firstStep, adjustedProgress.lerpFactor)
                    }
                } else {
                    // 步驟之間的正常過渡
                    const currentStep = stepData[adjustedProgress.currentIndex]
                    const nextStep = stepData[adjustedProgress.nextIndex]
                    
                    if (currentStep && nextStep) {
                        scrollTriggerEvents.interpolateMapPosition(currentStep, nextStep, adjustedProgress.lerpFactor)
                    }
                }
            }
        })

    },
    handleSidebarVisibility: (adjustedProgress, stepData) => {
        // 決定當前應該顯示的步驟
        let activeStep = null
        
        if (adjustedProgress.currentIndex === -1) {
            // 初始狀態或從初始狀態過渡中
            activeStep = { type: 'init' }
        } else if (adjustedProgress.lerpFactor < 0.5) {
            // 更接近當前步驟
            activeStep = stepData[adjustedProgress.currentIndex]
        } else {
            // 更接近下一個步驟
            activeStep = stepData[adjustedProgress.nextIndex] || stepData[adjustedProgress.currentIndex]
        }
        
        if (!activeStep) return
        
        // 檢查是否正在離開某個 section 的最後一個 location
        const isLeavingLastLocation = scrollTriggerEvents.isLeavingLastLocationOfSection(adjustedProgress, stepData)
        
        if (isLeavingLastLocation) {
            // 正在離開某個 section 的最後一個 location，關閉卡片
            domControlEvents.toggleDisplayLocationCardList(false)
            domControlEvents.closePinsPopup()
            state.curSectionId = null
        } else {
            // 正常更新側邊欄
            scrollTriggerEvents.updateSidebar(activeStep)
        }
    },
    isLeavingLastLocationOfSection: (adjustedProgress, stepData) => {
        // 檢查是否正在從某個 section 的最後一個 location 離開
        if (adjustedProgress.currentIndex < 0 || adjustedProgress.nextIndex >= stepData.length) {
            return false
        }
        
        const currentStep = stepData[adjustedProgress.currentIndex]
        const nextStep = stepData[adjustedProgress.nextIndex]
        
        if (!currentStep || !nextStep) return false
        
        // 如果當前步驟是 location 且是該 section 的最後一個，而下一步驟不是同 section 的 location
        if (currentStep.type === 'location' && scrollTriggerEvents.isLastLocationStep(currentStep)) {
            // 檢查是否正在過渡到下一步驟（lerpFactor > 0.1 表示更接近下一步驟）
            if (adjustedProgress.lerpFactor > 0.05) {
                return true
            }
        }
        
        return false
    },
    calculateStepProgressWithInit: (scrollProgress, totalSteps, pauseRatio, transitionRatio) => {
        // 總共有 totalSteps + 1 個狀態（包含初始狀態）
        const totalStates = totalSteps + 1
        const stepSize = 1 / (totalStates - 1)
        
        // 找出當前在哪個狀態區間內
        let currentStateIndex = -1 // -1 表示初始狀態
        let localProgress = 0
        
        for (let i = 0; i < totalStates - 1; i++) {
            const stepStart = i * stepSize
            const stepEnd = (i + 1) * stepSize
            
            if (scrollProgress >= stepStart && scrollProgress <= stepEnd) {
                currentStateIndex = i - 1 // -1, 0, 1, 2... (-1 是初始狀態)
                localProgress = (scrollProgress - stepStart) / stepSize
                break
            }
        }
        
        // 在每個狀態區間內，前 pauseRatio 的部分是停頓，後 transitionRatio 的部分是過渡
        if (localProgress <= pauseRatio) {
            // 停頓階段：保持在當前狀態
            return {
                currentIndex: currentStateIndex,
                nextIndex: currentStateIndex,
                lerpFactor: 0
            }
        } else {
            // 過渡階段：從當前狀態過渡到下一狀態
            const transitionProgress = (localProgress - pauseRatio) / transitionRatio
            return {
                currentIndex: currentStateIndex,
                nextIndex: Math.min(currentStateIndex + 1, totalSteps - 1),
                lerpFactor: transitionProgress
            }
        }
    },
    interpolateMapPosition: (currentStep, nextStep, lerpFactor) => {
        // 獲取當前和下一個步驟的地圖目標狀態
        const currentTarget = scrollTriggerEvents.getMapTarget(currentStep)
        const nextTarget = scrollTriggerEvents.getMapTarget(nextStep)
        
        if (!currentTarget || !nextTarget) return
        
        // 插值計算經緯度
        const interpolatedCenter = [
            currentTarget.center[0] + (nextTarget.center[0] - currentTarget.center[0]) * lerpFactor,
            currentTarget.center[1] + (nextTarget.center[1] - currentTarget.center[1]) * lerpFactor
        ]
        
        // 插值計算縮放級別
        const interpolatedZoom = currentTarget.zoom + (nextTarget.zoom - currentTarget.zoom) * lerpFactor
        
        // 插值計算偏移量
        const interpolatedOffset = [
            currentTarget.offset[0] + (nextTarget.offset[0] - currentTarget.offset[0]) * lerpFactor,
            currentTarget.offset[1] + (nextTarget.offset[1] - currentTarget.offset[1]) * lerpFactor
        ]
        
        // 計算考慮偏移的實際中心點
        const offsetCenter = scrollTriggerEvents.calculateOffsetCenter(interpolatedCenter, interpolatedOffset, interpolatedZoom)
        
        // 直接設置地圖狀態，不使用 flyTo
        map.setCenter(offsetCenter)
        map.setZoom(interpolatedZoom)
        
        //console.log(`地圖插值: center=[${offsetCenter[0].toFixed(4)}, ${offsetCenter[1].toFixed(4)}], zoom=${interpolatedZoom.toFixed(2)}, offset=[${interpolatedOffset[0]}, ${interpolatedOffset[1]}]`)
    },
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
            domControlEvents.toggleDisplayLocationCardList(false)
            domControlEvents.closePinsPopup()
            state.curSectionId = null
        } else if (step.type === 'section') {
            // section 步驟時：如果之前有顯示的 section 卡片，需要關閉
            if (state.curSectionId) {
                domControlEvents.toggleDisplayLocationCardList(false)
                domControlEvents.closePinsPopup()
                state.curSectionId = null
            }
        } else if (step.type === 'location') {
            // 先確保該地點所屬區域的卡片已顯示
            if (!state.curSectionId || state.curSectionId !== step.data.sectionId) {
                state.curSectionId = step.data.sectionId
                domControlEvents.toggleDisplayLocationCards(step.data.sectionId)
            }
            
            // 高亮當前地點卡片
            domControlEvents.activeLocationCard(step.data.id)
            // 顯示地圖標記彈窗
            domControlEvents.openPinPopup(step.data.id)
        }
    },
    isLastLocationStep: (currentStep) => {
        if (currentStep.type !== 'location') return false
        
        // 找到當前 section 的所有 location 步驟
        const currentSectionId = currentStep.data.sectionId
        const currentSectionLocations = state.stepData.filter(step => 
            step.type === 'location' && step.data.sectionId === currentSectionId
        )
        
        if (currentSectionLocations.length === 0) return false
        
        // 檢查當前步驟是否是該 section 的最後一個 location
        const lastLocationInSection = currentSectionLocations[currentSectionLocations.length - 1]
        return currentStep.data.id === lastLocationInSection.data.id
    },
    getMapTarget: (step) => {
        // 根據步驟類型返回目標地圖狀態
        if (step.type === 'init') {
            // 初始狀態
            return {
                center: mapControl.initMapPosition.center,
                zoom: mapControl.initMapPosition.zoom,
                offset: [0, 0]
            }
        } else if (step.type === 'section') {
            const locations = state.locationsObj[step.data.id]
            if (locations && locations.length > 0) {
                // 計算區域的中心點和適當的縮放級別
                const bounds = new mapboxgl.LngLatBounds()
                locations.forEach(location => bounds.extend(location.position))
                const center = bounds.getCenter()
                return {
                    center: [center.lng, center.lat],
                    zoom: 10,
                    offset: [0, 0]
                }
            }
        } else if (step.type === 'location') {
            return {
                center: step.data.position,
                zoom: 12,
                offset: [150, 0] // location 需要向左偏移適應右側版面
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
        domControlEvents.toggleDisplayLocationCardList(false)
        domControlEvents.closePinsPopup()
        state.curSectionId = null
    },
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
    dragPan: false,
    ...mapControl.initMapPosition
})
map.addControl(new mapboxgl.NavigationControl())
map.scrollZoom.disable()

map.on('load', async () => {
    await domControlEvents.loadPins()
})
map.on('style.load', () => {
    map.setFog({})
})