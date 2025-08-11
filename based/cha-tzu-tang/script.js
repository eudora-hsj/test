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
    flyToInit: () => {
        map.flyTo({
            ...mapControl.initMapPosition
        })
    },
    flyToSections: (sectionId, isDetail) => {
        const locations = state.locationsObj[sectionId]
        if (locations.length > 0) {
            const bounds = new mapboxgl.LngLatBounds()
            locations.forEach(location => {
                bounds.extend(location.position)
            })

            map.fitBounds(bounds, {
                padding: {
                    top: 100,
                    bottom: 100,
                    right: isDetail ? 500 : 100,
                    left: 100
                },
                maxZoom: 10,
                center: bounds.getCenter(),
                // offset: isDetail ? [-200, 0] : [0, 0]
            })
        }
    },
    flyToLocation: (location) => {
        mapControl.flyToSections(location.sectionId, true)
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
            onEnter: () => {
                scrollTriggerEvents.toInit()
            },
            onLeaveBack: () => scrollTriggerEvents.toInit()
        })

        // 4. 為每個步驟建立獨立的 ScrollTrigger 來觸發 callback
        const steps = gsap.utils.toArray(".step")
        steps.forEach((step, i) => {
            // 計算每個步驟的平均觸發點
            const isFirstStep = i === 0;
            const triggerProgress = isFirstStep ? 
                (i + 0.8) / stepData.length : // 第一步延後觸發，讓它保持更久
                (i + 0.5) / stepData.length; // 其他步驟正常觸發
            const triggerPercent = Math.round(triggerProgress * 100);
            
            ScrollTrigger.create({
                trigger: step,
                start: `top ${100 - triggerPercent}%`, // 動態計算觸發點
                end: isFirstStep ? "bottom 15%" : "bottom 25%", // 第一步延後結束
                onEnter: () => {
                    console.log(`步驟 ${i} 進入 (觸發點: ${100 - triggerPercent}%)`);
                    stepData[i].callback()
                },
                onEnterBack: () => {
                    console.log(`步驟 ${i} 返回`);
                    stepData[i].callback()
                }
            })
        })
    },
    toInit: () => {
        domControlEvents.toggleDisplayLocationCardList(false)
        domControlEvents.closePinsPopup()
        mapControl.flyToInit()
        state.curSectionId = null
    },
    toSections: (section) => {
        state.curSectionId = null
        domControlEvents.toggleDisplayLocationCards(false)
        domControlEvents.closePinsPopup()
        mapControl.flyToSections(section.id)
    },
    toLocation: (location) => {
        if (!state.curSectionId || state.curSectionId !== location.sectionId) {
            state.curSectionId = location.sectionId
            domControlEvents.toggleDisplayLocationCards(location.sectionId)
        }


        domControlEvents.openPinPopup(location.id)
        domControlEvents.activeLocationCard(location.id)
        mapControl.flyToLocation(location)
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
            data: section,
            callback: () => {
                scrollTriggerEvents.toSections(section)
            }
        })
        state.locationsObj[section.id].forEach(location => {
            stepData.push({
                type: 'location',
                data: location,
                callback: () => {
                    scrollTriggerEvents.toLocation(location)
                }
            })
        })
    })

    // 添加一個額外的步驟，讓最后一個狀態保持更久
    const lastLocation = stepData[stepData.length - 1];
    if (lastLocation && lastLocation.type === 'location') {
        stepData.push({
            type: 'location-extended',
            data: lastLocation.data,
            callback: () => {
                // 保持最后一個位置的狀態
                scrollTriggerEvents.toLocation(lastLocation.data)
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