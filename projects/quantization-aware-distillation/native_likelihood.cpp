// Raw causal likelihood: explicit BOS, no chat/EOS, strict joint-token boundary.
#include "llama.h"
#include "ggml-backend.h"
#include "nlohmann/json.hpp"
#include <algorithm>
#include <cmath>
#include <fstream>
#include <iostream>
#include <memory>
#include <set>
#include <stdexcept>
#include <string>
#include <vector>
using json=nlohmann::ordered_json;
static std::vector<llama_token> tokenize(const llama_vocab *v,const std::string&s) {
    int n=llama_tokenize(v,s.data(),s.size(),nullptr,0,false,false);
    if(n>0) throw std::runtime_error("tokenize sizing");
    std::vector<llama_token> t(-n);
    int got=llama_tokenize(v,s.data(),s.size(),t.data(),t.size(),false,false);
    if(got<0) throw std::runtime_error("tokenize failed"); t.resize(got); return t;
}
static json evaluate(llama_model*m,const std::vector<llama_token>&all,int prefix,int chunk,int threads,int cap,const std::string&dump) {
    const int n=all.size()-1, nv=llama_vocab_n_tokens(llama_model_get_vocab(m));
    auto p=llama_context_default_params(); p.n_ctx=cap;p.n_batch=std::min(chunk,cap);p.n_ubatch=p.n_batch;
    p.n_threads=threads;p.n_threads_batch=threads;p.offload_kqv=false;p.op_offload=false;
    p.type_k=GGML_TYPE_F32;p.type_v=GGML_TYPE_F32;p.flash_attn_type=LLAMA_FLASH_ATTN_TYPE_DISABLED;
    std::unique_ptr<llama_context,decltype(&llama_free)> ctx(llama_init_from_model(m,p),llama_free);
    if(!ctx) throw std::runtime_error("context initialization failed");
    std::ofstream logits;
    if(!dump.empty()){logits.open(dump,std::ios::binary);if(!logits)throw std::runtime_error("logit file failed");}
    json lp=json::array(),positions=json::array(); double sum=0;
    for(int start=0;start<n;start+=chunk){
        int count=std::min(chunk,n-start);auto b=llama_batch_init(count,0,1);b.n_tokens=count;
        for(int i=0;i<count;i++){b.token[i]=all[start+i];b.pos[i]=start+i;b.n_seq_id[i]=1;b.seq_id[i][0]=0;b.logits[i]=true;}
        int rc=llama_decode(ctx.get(),b);llama_batch_free(b);if(rc)throw std::runtime_error("decode failed "+std::to_string(rc));
        for(int i=0;i<count;i++){
            int pos=start+i;if(pos<prefix-1)continue;
            const float*x=llama_get_logits_ith(ctx.get(),i);if(!x)throw std::runtime_error("missing logits");
            double mx=*std::max_element(x,x+nv),z=0;
            for(int j=0;j<nv;j++){if(!std::isfinite(x[j]))throw std::runtime_error("nonfinite logits");z+=std::exp(double(x[j])-mx);}
            double value=double(x[all[pos+1]])-mx-std::log(z);if(!std::isfinite(value))throw std::runtime_error("nonfinite likelihood");
            lp.push_back(value);positions.push_back(pos);sum+=value;
            if(logits)logits.write(reinterpret_cast<const char*>(x),nv*sizeof(float));
        }
    }
    if(lp.size()!=all.size()-prefix)throw std::runtime_error("score count mismatch");
    return json{{"sum_logprob",sum},{"token_logprobs",lp},{"predictor_positions",positions},{"vocab_size",nv},{"chunk",chunk},{"logits_file",dump}};
}
int main(int argc,char**argv){
 try{
    if(argc!=8)throw std::runtime_error("usage: qad-likelihood MODEL INPUT_JSONL OUTPUT_JSONL THREADS CHUNK CONTEXT AUDIT_0_OR_1");
    int threads=std::stoi(argv[4]),chunk=std::stoi(argv[5]),cap=std::stoi(argv[6]),audit=std::stoi(argv[7]);
    if(threads<1||chunk<1||cap<8||chunk>cap||(audit!=0&&audit!=1))throw std::runtime_error("invalid execution limits");
    // Never load accelerator plugins; existing linked ggml CPU backend only.
    llama_backend_init();auto mp=llama_model_default_params();mp.n_gpu_layers=0;
    mp.devices=nullptr;
    std::unique_ptr<llama_model,decltype(&llama_model_free)> model(llama_model_load_from_file(argv[1],mp),llama_model_free);
    if(!model)throw std::runtime_error("model load failed");const auto*v=llama_model_get_vocab(model.get());
    auto bos=llama_vocab_bos(v);if(bos<0)throw std::runtime_error("BOS unavailable");
    std::ifstream in(argv[2]);std::ofstream out(argv[3]);if(!in||!out)throw std::runtime_error("input/output open failed");
    std::string line;std::set<std::string> seen;int count=0;
    while(std::getline(in,line)){
      auto r=json::parse(line);std::string id=r.at("id");if(!seen.insert(id).second)throw std::runtime_error("duplicate request ID");
      json result{{"schema","maccrate.qad.native_likelihood.v1"},{"id",id}};
      try{
        std::string context=r.at("context"),continuation=r.at("continuation");
        if(context.empty()||continuation.empty())throw std::runtime_error("empty context/continuation");
        if(std::isspace(static_cast<unsigned char>(context.back())))throw std::runtime_error("context trailing whitespace: move in adapter");
        auto prefix=tokenize(v,context),whole=tokenize(v,context+continuation);
        prefix.insert(prefix.begin(),bos);whole.insert(whole.begin(),bos);
        result["context_ids"]=prefix;result["joint_ids"]=whole;result["bos_id"]=bos;
        if(whole.size()<=prefix.size()||!std::equal(prefix.begin(),prefix.end(),whole.begin()))throw std::runtime_error("retokenized_or_empty_boundary");
        if(whole.size()>size_t(cap))throw std::runtime_error("context_overflow_no_truncation");
        result["continuation_ids"]=std::vector<llama_token>(whole.begin()+prefix.size(),whole.end());
        if(r.value("tokenize_only",false)){result["status"]="tokenized";}
        else{
          result["batched"]=evaluate(model.get(),whole,prefix.size(),chunk,threads,cap,r.value("logits_file",std::string{}));
          if(audit)result["sequential"]=evaluate(model.get(),whole,prefix.size(),1,threads,cap,"");
          result["status"]="ok";
        }
      }catch(const std::exception&e){result["status"]="error";result["error"]=e.what();}
      out<<result.dump()<<'\n';out.flush();count++;
    }
    if(!count)throw std::runtime_error("empty request file");return 0;
 }catch(const std::exception&e){std::cerr<<e.what()<<'\n';return 2;}
}
