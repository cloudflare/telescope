export class R2Client {
  private bucket: any;
  constructor(bucketBinding: any) {
    this.bucket = bucketBinding;
  }
  async put(key: string, value: any) {
    return await this.bucket.put(key, value);
  }
  async get(key: string) {
    return await this.bucket.get(key);
  }
  async list(options?: { prefix?: string; limit?: number }) {
    return await this.bucket.list(options);
  }
  async delete(key: string) {
    return await this.bucket.delete(key);
  }
}