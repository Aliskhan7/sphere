import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { Hands } from '@mediapipe/hands';

const COUNT = 15000;

const generateShape = (shape) => {
  const pos = new Float32Array(COUNT * 3);
  for (let i = 0; i < COUNT; i++) {
    const i3 = i * 3;
    let x, y, z;
    if (shape === 'SATURN') {
      if (i < COUNT * 0.6) { // Сфера
        const phi = Math.acos(2 * Math.random() - 1);
        const theta = Math.random() * Math.PI * 2;
        x = 2.5 * Math.sin(phi) * Math.cos(theta);
        y = 2.5 * Math.sin(phi) * Math.sin(theta);
        z = 2.5 * Math.cos(phi);
      } else { // Кольцо
        const angle = Math.random() * Math.PI * 2;
        const r = 3.5 + Math.random() * 1.5;
        x = Math.cos(angle) * r;
        y = Math.sin(angle) * r * 0.2;
        z = Math.sin(angle) * r;
      }
    } else if (shape === 'HEART') {
      const t = Math.random() * Math.PI * 2;
      x = 0.2 * (16 * Math.pow(Math.sin(t), 3));
      y = 0.2 * (13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      z = (Math.random() - 0.5) * 1.5;
    } else { // SPHERE
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      x = 3.5 * Math.sin(phi) * Math.cos(theta);
      y = 3.5 * Math.sin(phi) * Math.sin(theta);
      z = 3.5 * Math.cos(phi);
    }
    pos[i3] = x; pos[i3+1] = y; pos[i3+2] = z;
  }
  return pos;
};

// Компонент для плавного управления камерой
function CameraController({ targetZoom }) {
  const { camera } = useThree();
  
  useFrame(() => {
    // Плавное изменение позиции камеры
    camera.position.z += (targetZoom - camera.position.z) * 0.1;
  });
  
  return null;
}

function Particles({ handPos, shape, rotationAngle }) {
  const ref = useRef();
  const targetData = useMemo(() => generateShape(shape), [shape]);
  // Инициализируем позиции из целевой формы, чтобы частицы сразу были видны
  const initialPos = useMemo(() => {
    const pos = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      pos[i3] = targetData[i3];
      pos[i3 + 1] = targetData[i3 + 1];
      pos[i3 + 2] = targetData[i3 + 2];
    }
    return pos;
  }, [targetData]);

  useFrame((state) => {
    if (!ref.current) return;
    const geo = ref.current.geometry.attributes.position;
    const time = state.clock.elapsedTime;

    for (let i = 0; i < COUNT; i++) {
      const i3 = i * 3;
      let tx = targetData[i3];
      let ty = targetData[i3 + 1];
      let tz = targetData[i3 + 2];

      // Применяем вращение к целевым позициям
      if (rotationAngle !== 0) {
        const cos = Math.cos(rotationAngle);
        const sin = Math.sin(rotationAngle);
        const newX = tx * cos - tz * sin;
        const newZ = tx * sin + tz * cos;
        tx = newX;
        tz = newZ;
      }

      if (handPos && handPos.x !== undefined && handPos.y !== undefined) {
        // Преобразуем координаты MediaPipe (0-1) в координаты Three.js
        // MediaPipe: x (0=left, 1=right), y (0=top, 1=bottom)
        // Three.js: x (left=-, right=+), y (bottom=-, top=+)
        const hx = (handPos.x - 0.5) * 15; // -7.5 to 7.5
        const hy = (0.5 - handPos.y) * 15; // flip Y: 7.5 to -7.5
        const hz = 0; // Рука всегда на плоскости Z=0
        
        // Вычисляем расстояние от частицы до руки в 3D
        const dx = hx - geo.array[i3];
        const dy = hy - geo.array[i3 + 1];
        const dz = hz - geo.array[i3 + 2];
        const distance3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
        
        // Радиус взаимодействия - увеличил для более заметного эффекта
        const interactionRadius = 4.0;
        
        if (distance3D < interactionRadius) {
          // Сила отталкивания зависит от расстояния
          const force = (interactionRadius - distance3D) / interactionRadius;
          const pushStrength = force * 1.2; // Увеличил силу
          
          // Нормализуем направление
          const normalizedDx = distance3D > 0 ? dx / distance3D : 0;
          const normalizedDy = distance3D > 0 ? dy / distance3D : 0;
          const normalizedDz = distance3D > 0 ? dz / distance3D : 0;
          
          // Отталкиваем частицы от руки
          tx += normalizedDx * pushStrength;
          ty += normalizedDy * pushStrength;
          tz += normalizedDz * pushStrength + Math.sin(time * 3 + i * 0.1) * 0.3;
        }
      }

      // Плавное следование за формой
      geo.array[i3] += (tx - geo.array[i3]) * 0.08;
      geo.array[i3 + 1] += (ty - geo.array[i3 + 1]) * 0.08;
      geo.array[i3 + 2] += (tz - geo.array[i3 + 2]) * 0.08;
    }
    geo.needsUpdate = true;
    // Автоматическое вращение замедлено, так как теперь управляется вручную
    ref.current.rotation.y += 0.0005;
  });

  return (
    <Points ref={ref} positions={initialPos} stride={3}>
      <PointMaterial 
        transparent 
        color="#ffdf7e" 
        size={0.06} 
        sizeAttenuation={true}
        blending={THREE.AdditiveBlending} 
        depthWrite={false} 
      />
    </Points>
  );
}

export default function App() {
  const videoRef = useRef(null);
  const [handPos, setHandPos] = useState(null);
  const [shape, setShape] = useState('SATURN');
  const [zoom, setZoom] = useState(15); // Начальная дистанция камеры
  const [rotationAngle, setRotationAngle] = useState(0); // Угол вращения
  const [cameraStatus, setCameraStatus] = useState('Инициализация...');
  const [handDetected, setHandDetected] = useState(false);
  const [showDebugVideo, setShowDebugVideo] = useState(false);
  const previousPinchDistance = useRef(null);
  const previousHandX = useRef(null);

  useEffect(() => {
    // Проверяем наличие MediaPipe Camera Utils
    if (typeof window.Camera === 'undefined') {
      setCameraStatus('Ошибка: MediaPipe Camera Utils не загружены');
      console.error('MediaPipe Camera Utils не загружены. Проверьте index.html');
      return;
    }

    let hands;
    let camera;

    const initCamera = async () => {
      try {
        // Проверяем доступность камеры
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Браузер не поддерживает доступ к камере');
        }

        setCameraStatus('Запрос доступа к камере...');
        
        // Проверяем разрешения
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: 640, 
            height: 480,
            facingMode: 'user'
          } 
        });
        stream.getTracks().forEach(track => track.stop());

        setCameraStatus('Инициализация MediaPipe...');

        hands = new Hands({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
        });
        
        hands.setOptions({ 
          maxNumHands: 1, 
          modelComplexity: 1, 
          minDetectionConfidence: 0.2, // Снизил порог для более чувствительного обнаружения
          minTrackingConfidence: 0.2
        });
        
        hands.onResults(res => {
          // Проверяем наличие результатов
          if (res && res.multiHandLandmarks && res.multiHandLandmarks.length > 0) {
            const landmarks = res.multiHandLandmarks[0];
            
            // Проверяем, что landmarks валидны
            if (landmarks && landmarks.length > 8) {
              const indexFinger = landmarks[8]; // Указательный палец
              
              // Проверяем, что координаты валидны
              if (indexFinger && 
                  typeof indexFinger.x === 'number' && 
                  typeof indexFinger.y === 'number' &&
                  !isNaN(indexFinger.x) && 
                  !isNaN(indexFinger.y)) {
                
                setHandPos({ x: indexFinger.x, y: indexFinger.y });
                setHandDetected(true);
                setCameraStatus('Рука обнаружена ✓');
                
                // Определяем жест pinch (расстояние между указательным и большим пальцем)
                if (landmarks.length > 4) {
                  const thumb = landmarks[4];
                  const index = landmarks[8];
                  
                  if (thumb && index && 
                      typeof thumb.x === 'number' && typeof thumb.y === 'number' &&
                      typeof index.x === 'number' && typeof index.y === 'number') {
                    
                    const pinchDistance = Math.sqrt(
                      Math.pow(thumb.x - index.x, 2) + 
                      Math.pow(thumb.y - index.y, 2)
                    );
                    
                    // Если это первый раз или расстояние изменилось значительно
                    if (previousPinchDistance.current !== null) {
                      const delta = previousPinchDistance.current - pinchDistance;
                      // Если пальцы сближаются - приближаем, если раздвигаются - отдаляем
                      if (Math.abs(delta) > 0.015) {
                        setZoom(prev => {
                          const newZoom = prev + delta * 40; // Множитель для чувствительности
                          return Math.max(5, Math.min(30, newZoom)); // Ограничения: от 5 до 30
                        });
                      }
                    }
                    previousPinchDistance.current = pinchDistance;
                  }
                }
                
                // Отслеживаем движение руки влево/вправо для вращения
                if (previousHandX.current !== null) {
                  const deltaX = indexFinger.x - previousHandX.current;
                  // Если рука движется влево/вправо, вращаем фигуру
                  if (Math.abs(deltaX) > 0.005) {
                    setRotationAngle(prev => {
                      const newAngle = prev + deltaX * 2; // Множитель для чувствительности
                      return newAngle; // Без ограничений, можно крутить бесконечно
                    });
                  }
                }
                previousHandX.current = indexFinger.x;
              }
            }
          } else {
            // Рука не обнаружена
            setHandPos(null);
            setHandDetected(false);
            setCameraStatus('Камера активна - покажите руку');
            previousPinchDistance.current = null;
            previousHandX.current = null;
          }
        });

        if (videoRef.current) {
          setCameraStatus('Запуск камеры...');
          
          try {
            camera = new window.Camera(videoRef.current, {
              onFrame: async () => {
                try {
                  if (videoRef.current && 
                      videoRef.current.readyState === 4 && 
                      videoRef.current.videoWidth > 0 &&
                      videoRef.current.videoHeight > 0) {
                    await hands.send({ image: videoRef.current });
                  }
                } catch (err) {
                  console.error('Ошибка обработки кадра:', err);
                }
              },
              width: 640, 
              height: 480
            });
            
            camera.start();
            setCameraStatus('Камера подключена - покажите руку');
          } catch (err) {
            console.error('Ошибка запуска камеры:', err);
            setCameraStatus(`Ошибка запуска камеры: ${err.message}`);
          }
        }
      } catch (err) {
        console.error('Ошибка инициализации камеры:', err);
        setCameraStatus(`Ошибка: ${err.message}`);
      }
    };

    initCamera();

    // Cleanup
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject;
        stream.getTracks().forEach(track => track.stop());
      }
      if (camera) {
        try {
          camera.stop();
        } catch (e) {
          console.error('Ошибка остановки камеры:', e);
        }
      }
    };
  }, []);

  // Обработчик колесика мыши для зума
  const handleWheel = (e) => {
    e.preventDefault();
    setZoom(prev => {
      const delta = e.deltaY > 0 ? 1.5 : -1.5;
      const newZoom = prev + delta;
      return Math.max(5, Math.min(30, newZoom)); // Ограничения: от 5 до 30
    });
  };

  return (
    <div 
      style={{ width: '100vw', height: '100vh', background: '#000', overflow: 'hidden' }}
      onWheel={handleWheel}
    >
      <video 
        ref={videoRef} 
        style={{ 
          display: showDebugVideo ? 'block' : 'none',
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '200px',
          height: '150px',
          border: '2px solid #00ff00',
          borderRadius: '10px',
          zIndex: 1000
        }}
        autoPlay
        playsInline
        muted
      />
      
      <div style={{ position: 'absolute', bottom: '50px', left: '50%', transform: 'translateX(-50%)', zIndex: 100, display: 'flex', gap: '10px', alignItems: 'center' }}>
        {['SATURN', 'HEART', 'SPHERE'].map(s => (
          <button key={s} onClick={() => setShape(s)} style={{
            background: shape === s ? '#ffdf7e' : 'rgba(255,255,255,0.1)',
            color: shape === s ? '#000' : '#fff',
            border: 'none', padding: '10px 25px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', transition: '0.3s'
          }}>{s}</button>
        ))}
        
        {/* Кнопки зума */}
        <div style={{ display: 'flex', gap: '5px', marginLeft: '20px' }}>
          <button 
            onClick={() => setZoom(prev => Math.max(5, prev - 2))}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: 'none',
              padding: '10px 15px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '18px'
            }}
          >−</button>
          <button 
            onClick={() => setZoom(prev => Math.min(30, prev + 2))}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: 'none',
              padding: '10px 15px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '18px'
            }}
          >+</button>
        </div>
        
        {/* Кнопки вращения */}
        <div style={{ display: 'flex', gap: '5px', marginLeft: '20px' }}>
          <button 
            onClick={() => setRotationAngle(prev => prev - 0.2)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: 'none',
              padding: '10px 15px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '18px'
            }}
            title="Повернуть влево"
          >↶</button>
          <button 
            onClick={() => setRotationAngle(prev => prev + 0.2)}
            style={{
              background: 'rgba(255,255,255,0.1)',
              color: '#fff',
              border: 'none',
              padding: '10px 15px',
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '18px'
            }}
            title="Повернуть вправо"
          >↷</button>
        </div>
      </div>

      <Canvas camera={{ position: [0, 0, zoom], fov: 50 }}>
        <CameraController targetZoom={zoom} />
        <Particles handPos={handPos} shape={shape} rotationAngle={rotationAngle} />
      </Canvas>
      
      {/* Визуальный индикатор позиции руки для отладки */}
      {handPos && handPos.x !== undefined && (
        <div style={{
          position: 'absolute',
          left: `${handPos.x * 100}%`,
          top: `${handPos.y * 100}%`,
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          background: 'rgba(0, 255, 0, 0.5)',
          border: '2px solid #00ff00',
          transform: 'translate(-50%, -50%)',
          pointerEvents: 'none',
          zIndex: 1000,
          transition: 'all 0.1s'
        }} />
      )}
      
      {/* Статус и подсказки */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: 'rgba(255,255,255,0.9)',
        fontSize: '12px',
        fontFamily: 'sans-serif',
        background: 'rgba(0,0,0,0.7)',
        padding: '15px',
        borderRadius: '10px',
        border: handDetected ? '2px solid #00ff00' : '2px solid rgba(255,255,255,0.3)'
      }}>
        <div style={{ 
          marginBottom: '10px',
          color: handDetected ? '#00ff00' : '#ff6b6b',
          fontWeight: 'bold',
          fontSize: '14px'
        }}>
          {handDetected ? '✓ ' : '○ '} {cameraStatus}
        </div>
        {handPos && handPos.x !== undefined && (
          <div style={{ marginBottom: '5px', fontSize: '11px', color: '#00ff00' }}>
            Координаты: X: {handPos.x.toFixed(3)}, Y: {handPos.y.toFixed(3)}
          </div>
        )}
        {handDetected && (
          <div style={{ 
            marginTop: '10px', 
            padding: '8px', 
            background: 'rgba(0,255,0,0.2)', 
            borderRadius: '5px',
            fontSize: '11px'
          }}>
            <div style={{ color: '#00ff00', fontWeight: 'bold', marginBottom: '5px' }}>
              Рука обнаружена! Двигайте рукой для взаимодействия
            </div>
          </div>
        )}
        <div style={{ marginTop: '10px', fontSize: '11px', opacity: 0.8 }}>
          <div>• Колесико мыши или кнопки +/- для зума</div>
          <div>• Сожмите большой и указательный палец для приближения</div>
          <div>• Разожмите пальцы для отдаления</div>
          <div>• Двигайте рукой влево/вправо для вращения</div>
          <div>• Кнопки ↶ ↷ для точного вращения</div>
          <div style={{ marginTop: '10px' }}>
            <button
              onClick={() => setShowDebugVideo(!showDebugVideo)}
              style={{
                background: showDebugVideo ? 'rgba(0,255,0,0.3)' : 'rgba(255,255,255,0.1)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '5px 10px',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '10px'
              }}
            >
              {showDebugVideo ? 'Скрыть видео' : 'Показать видео камеры'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}