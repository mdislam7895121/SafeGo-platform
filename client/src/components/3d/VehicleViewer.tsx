import { useRef, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import {
  VehicleType,
  VEHICLE_TYPE_CONFIG,
  normalizeVehicleType,
  createVehicleMaterial,
  createGlassMaterial,
  createWheelMaterial,
  createTireMaterial,
  createHeadlightMaterial,
  createTaillightMaterial,
} from '@/utils/vehicle3DMapper';

interface Vehicle3DModelProps {
  vehicleType: VehicleType;
  color: string;
  autoRotate?: boolean;
}

function Vehicle3DModel({ vehicleType, color, autoRotate = true }: Vehicle3DModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const config = VEHICLE_TYPE_CONFIG[vehicleType] || VEHICLE_TYPE_CONFIG.sedan;

  const materials = useMemo(() => ({
    body: createVehicleMaterial(color),
    glass: createGlassMaterial(),
    wheel: createWheelMaterial(),
    tire: createTireMaterial(),
    headlight: createHeadlightMaterial(),
    taillight: createTaillightMaterial(),
  }), [color]);

  useFrame((state) => {
    if (autoRotate && groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.3;
    }
  });

  if (vehicleType === 'motorcycle') {
    return (
      <group ref={groupRef} position={[0, 0.5, 0]}>
        <mesh position={[0, 0.4, 0]} material={materials.body}>
          <boxGeometry args={[1.8, 0.3, 0.4]} />
        </mesh>
        <mesh position={[0.3, 0.7, 0]} material={materials.body}>
          <boxGeometry args={[0.8, 0.5, 0.35]} />
        </mesh>
        <mesh position={[-0.6, 0.35, 0]} material={materials.tire}>
          <cylinderGeometry args={[0.35, 0.35, 0.15, 24]} />
        </mesh>
        <mesh position={[0.7, 0.35, 0]} material={materials.tire}>
          <cylinderGeometry args={[0.35, 0.35, 0.15, 24]} />
        </mesh>
      </group>
    );
  }

  const [bodyX, bodyY, bodyZ] = config.bodyScale;
  const [roofX, roofY, roofZ] = config.roofScale;
  const wheelPositions = [
    [-config.wheelBaseWidth / 2, config.wheelRadius, bodyZ / 2 - 0.1],
    [-config.wheelBaseWidth / 2, config.wheelRadius, -bodyZ / 2 + 0.1],
    [config.wheelBaseWidth / 2, config.wheelRadius, bodyZ / 2 - 0.1],
    [config.wheelBaseWidth / 2, config.wheelRadius, -bodyZ / 2 + 0.1],
  ] as [number, number, number][];

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      <mesh position={[0, bodyY / 2 + config.wheelRadius, 0]} material={materials.body}>
        <boxGeometry args={[bodyX, bodyY, bodyZ]} />
      </mesh>

      {config.roofHeight > 0 && (
        <mesh
          position={[config.roofOffset, bodyY + config.roofHeight / 2 + config.wheelRadius, 0]}
          material={materials.body}
        >
          <boxGeometry args={[roofX, roofY, roofZ]} />
        </mesh>
      )}

      {config.roofHeight > 0 && (
        <>
          <mesh
            position={[config.roofOffset + roofX / 2 - 0.1, bodyY + config.roofHeight / 2 + config.wheelRadius - 0.05, 0]}
            rotation={[0, 0, -Math.PI / 12]}
            material={materials.glass}
          >
            <boxGeometry args={[0.05, roofY * 0.9, roofZ * 0.85]} />
          </mesh>
          <mesh
            position={[config.roofOffset - roofX / 2 + 0.1, bodyY + config.roofHeight / 2 + config.wheelRadius - 0.05, 0]}
            rotation={[0, 0, Math.PI / 12]}
            material={materials.glass}
          >
            <boxGeometry args={[0.05, roofY * 0.9, roofZ * 0.85]} />
          </mesh>
          <mesh
            position={[config.roofOffset, bodyY + config.roofHeight / 2 + config.wheelRadius, roofZ / 2 - 0.02]}
            material={materials.glass}
          >
            <boxGeometry args={[roofX * 0.9, roofY * 0.8, 0.02]} />
          </mesh>
          <mesh
            position={[config.roofOffset, bodyY + config.roofHeight / 2 + config.wheelRadius, -roofZ / 2 + 0.02]}
            material={materials.glass}
          >
            <boxGeometry args={[roofX * 0.9, roofY * 0.8, 0.02]} />
          </mesh>
        </>
      )}

      <mesh
        position={[bodyX / 2 - 0.02, bodyY / 2 + config.wheelRadius, 0]}
        material={materials.headlight}
      >
        <boxGeometry args={[0.05, bodyY * 0.2, bodyZ * 0.6]} />
      </mesh>

      <mesh
        position={[-bodyX / 2 + 0.02, bodyY / 2 + config.wheelRadius, 0]}
        material={materials.taillight}
      >
        <boxGeometry args={[0.05, bodyY * 0.15, bodyZ * 0.5]} />
      </mesh>

      {wheelPositions.map((pos, i) => (
        <group key={i} position={pos}>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.tire}>
            <cylinderGeometry args={[config.wheelRadius, config.wheelRadius, 0.25, 24]} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} material={materials.wheel}>
            <cylinderGeometry args={[config.wheelRadius * 0.7, config.wheelRadius * 0.7, 0.26, 8]} />
          </mesh>
        </group>
      ))}

      {vehicleType === 'truck' || vehicleType === 'pickup' ? (
        <mesh
          position={[-bodyX / 4 - 0.2, bodyY * 0.4 + config.wheelRadius, 0]}
          material={materials.body}
        >
          <boxGeometry args={[bodyX / 2 - 0.4, bodyY * 0.5, bodyZ * 0.95]} />
        </mesh>
      ) : null}
    </group>
  );
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[2, 1, 1]} />
      <meshStandardMaterial color="#374151" wireframe />
    </mesh>
  );
}

interface VehicleViewerProps {
  vehicleType?: string;
  vehicleColor?: string;
  className?: string;
  height?: string | number;
  autoRotate?: boolean;
  showControls?: boolean;
}

export function VehicleViewer({
  vehicleType = 'sedan',
  vehicleColor = 'Silver',
  className = '',
  height = '200px',
  autoRotate = true,
  showControls = true,
}: VehicleViewerProps) {
  const normalizedType = normalizeVehicleType(vehicleType);

  return (
    <div 
      className={`w-full bg-gradient-to-b from-muted/30 to-muted/60 rounded-lg overflow-hidden ${className}`}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
      data-testid="vehicle-3d-viewer"
    >
      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[5, 3, 5]} fov={45} />
        
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 10, 5]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[1024, 1024]}
        />
        <directionalLight position={[-5, 5, -5]} intensity={0.5} />
        <pointLight position={[0, 5, 0]} intensity={0.3} />

        <Suspense fallback={<LoadingFallback />}>
          <Vehicle3DModel
            vehicleType={normalizedType}
            color={vehicleColor}
            autoRotate={autoRotate}
          />
          
          <ContactShadows
            position={[0, 0, 0]}
            opacity={0.4}
            scale={12}
            blur={2}
            far={4}
          />
          
          <Environment preset="city" />
        </Suspense>

        {showControls && (
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2.2}
            minDistance={4}
            maxDistance={12}
            autoRotate={false}
          />
        )}
      </Canvas>
    </div>
  );
}

export default VehicleViewer;
