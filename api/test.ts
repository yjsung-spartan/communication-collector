// 최소한의 테스트 API
export default function handler(req: any, res: any) {
  const timestamp = Date.now();
  
  // 로그
  console.log(`TEST API HIT at ${timestamp} from ${req.headers['user-agent']}`);
  
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  // 응답
  res.status(200).json({
    test: true,
    timestamp,
    uniqueId: `test_${timestamp}`,
    message: "If you see this exact timestamp, it's a real API call"
  });
}