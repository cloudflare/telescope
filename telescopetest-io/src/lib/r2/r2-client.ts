export class R2Client {
  private bucket: any;
  constructor(bucketBinding: any) {
    this.bucket = bucketBinding;
  }
  
  async put(key: string, value: any) {
    return await this.bucket.put(key, value);
  }
}